using System;
using System.Collections.Generic;
using DiagnosticsProcess = System.Diagnostics.Process;
using DiagnosticsProcessStartInfo = System.Diagnostics.ProcessStartInfo;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Threading;
using UnityEngine;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {
        private const int DefaultEmbeddedLocalLlmPort = 18080;
        private const int DefaultEmbeddedLocalLlmContext = 1024;
        private const int DefaultEmbeddedLocalLlmTimeoutMs = 4000;
        private const int DefaultEmbeddedLocalLlmReadyTimeoutMs = 4500;
        private const int EmbeddedLocalLlmReadyPollMs = 150;
        private const int BridgeFileRetryCount = 40;
        private const int BridgeFileRetryBaseMs = 20;
        private const int BridgeActionLockTimeoutMs = 2000;
        private const int BridgeActionLockRetryMs = 50;
        private const int BridgeActionLockStaleMs = 180000;

        [Serializable]
        private sealed class LocalLlmManifest
        {
            public LocalLlmManifestModel model = null;
        }

        [Serializable]
        private sealed class LocalLlmManifestModel
        {
            public string tier = "";
        }

        private void ConfigureBridgePaths()
        {
            statePath = Path.Combine(Application.streamingAssetsPath, "unity_state.json");
            viewModelPath = Path.Combine(Application.streamingAssetsPath, "unity_viewmodel.json");
            actionPath = Path.Combine(Application.streamingAssetsPath, "unity_action.json");
            resultPath = Path.Combine(Application.streamingAssetsPath, "unity_action_result.json");
        }


        private void StartUnityBridgeIfAvailable()
        {
            if (CommandLineFlag("-botc-no-bridge"))
            {
                bridgeLaunchStatus = "同步：测试模式未启动本地连接";
                bridgeLaunchProblem = false;
                return;
            }

            if (Application.isEditor)
            {
                bridgeLaunchStatus = "同步：Editor 手动连接";
                bridgeLaunchProblem = false;
                return;
            }

            var bridgeScript = FindUnityBridgeScript();
            if (string.IsNullOrWhiteSpace(bridgeScript))
            {
                bridgeLaunchStatus = "同步：未找到本地连接";
                bridgeLaunchProblem = true;
                Debug.LogWarning("Unity action bridge script was not found in StreamingAssets.");
                return;
            }

            try
            {
                var nodeExecutable = FindNodeExecutable();
                var args = string.Join(
                    " ",
                    new[]
                    {
                        QuoteProcessArgument(bridgeScript),
                        "--watch",
                        "--state=" + QuoteProcessArgument(statePath),
                        "--viewmodel=" + QuoteProcessArgument(viewModelPath),
                        "--action=" + QuoteProcessArgument(actionPath),
                        "--result=" + QuoteProcessArgument(resultPath)
                    }
                );
                var startInfo = new DiagnosticsProcessStartInfo
                {
                    FileName = nodeExecutable,
                    Arguments = args,
                    WorkingDirectory = BridgeWorkingDirectory(bridgeScript),
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden
                };
                ApplyBridgeLLMEnvironment(startInfo);
                bridgeProcess = new DiagnosticsProcess
                {
                    StartInfo = startInfo,
                    EnableRaisingEvents = false
                };
                bridgeProcess.Start();
                bridgeProcessStartedByUnity = true;
                bridgeLaunchProblem = false;
                bridgeLaunchStatus = IsBundledNodeRuntime(nodeExecutable) ? "同步：内置本地连接已启动" : "同步：本地连接已启动";
                Debug.Log($"Unity action bridge started from {bridgeScript} with {nodeExecutable}");
            }
            catch (Exception ex)
            {
                bridgeLaunchStatus = "同步：本地连接启动失败";
                bridgeLaunchProblem = true;
                Debug.LogWarning($"Failed to start Unity action bridge. Ensure Node.js is available in PATH. {ex.Message}");
                bridgeProcessStartedByUnity = false;
                bridgeProcess?.Dispose();
                bridgeProcess = null;
            }
        }


        private string FindUnityBridgeScript()
        {
            var streamingScript = Path.Combine(Application.streamingAssetsPath, "BotcJsCore", "scripts", "unity_action_bridge.mjs");
            if (File.Exists(streamingScript)) return streamingScript;

            var repoScript = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "scripts", "unity_action_bridge.mjs"));
            if (File.Exists(repoScript)) return repoScript;

            return "";
        }


        private string FindNodeExecutable()
        {
            var bundledNode = Path.Combine(Application.streamingAssetsPath, "BotcJsRuntime", "node.exe");
            return File.Exists(bundledNode) ? bundledNode : "node";
        }


        private bool IsBundledNodeRuntime(string nodeExecutable)
        {
            if (string.IsNullOrWhiteSpace(nodeExecutable)) return false;
            var bundledRoot = Path.Combine(Application.streamingAssetsPath, "BotcJsRuntime");
            return nodeExecutable.StartsWith(bundledRoot, StringComparison.OrdinalIgnoreCase);
        }


        private string BridgeWorkingDirectory(string bridgeScript)
        {
            var scriptsDir = Path.GetDirectoryName(bridgeScript);
            var rootDir = string.IsNullOrWhiteSpace(scriptsDir) ? "" : Path.GetDirectoryName(scriptsDir);
            return !string.IsNullOrWhiteSpace(rootDir) && Directory.Exists(rootDir)
                ? rootDir
                : Application.streamingAssetsPath;
        }


        private void ApplyBridgeLLMEnvironment(DiagnosticsProcessStartInfo startInfo)
        {
            if (startInfo == null) return;
            ClearBridgeLLMEnvironment(startInfo);
            if (!ShouldUseLocalLlmRenderer())
            {
                return;
            }

            var configuredEndpoint = Environment.GetEnvironmentVariable("BOTC_LLM_ENDPOINT");
            if (!string.IsNullOrWhiteSpace(configuredEndpoint))
            {
                SetOpenAICompatibleBridgeEnvironment(
                    startInfo,
                    configuredEndpoint,
                    Environment.GetEnvironmentVariable("BOTC_LLM_MODEL"),
                    Environment.GetEnvironmentVariable("BOTC_LLM_TIMEOUT_MS")
                );
                return;
            }

            var embeddedEndpoint = StartEmbeddedLocalLlmIfAvailable();
            if (!string.IsNullOrWhiteSpace(embeddedEndpoint))
            {
                SetOpenAICompatibleBridgeEnvironment(
                    startInfo,
                    embeddedEndpoint,
                    string.IsNullOrWhiteSpace(localLlmModelPath) ? "embedded-local-model" : Path.GetFileNameWithoutExtension(localLlmModelPath),
                    DefaultEmbeddedLocalLlmTimeoutMs.ToString()
                );
                return;
            }

            startInfo.EnvironmentVariables["BOTC_LLM_RENDERER"] = "1";
            startInfo.EnvironmentVariables["BOTC_LLM_PROVIDER"] = "ollama";
            startInfo.EnvironmentVariables["BOTC_LLM_OLLAMA_MODEL"] = Environment.GetEnvironmentVariable("BOTC_LLM_OLLAMA_MODEL") ?? "qwen2.5:3b";
            var ollamaEndpoint = Environment.GetEnvironmentVariable("BOTC_LLM_OLLAMA_ENDPOINT");
            if (!string.IsNullOrWhiteSpace(ollamaEndpoint)) startInfo.EnvironmentVariables["BOTC_LLM_OLLAMA_ENDPOINT"] = ollamaEndpoint;
            startInfo.EnvironmentVariables["BOTC_LLM_TIMEOUT_MS"] = Environment.GetEnvironmentVariable("BOTC_LLM_TIMEOUT_MS") ?? "1800";
        }


        private bool ShouldUseLocalLlmRenderer()
        {
            if (CommandLineFlag("-botc-no-llm-renderer")) return false;
            if (CommandLineFlag("-botc-llm-renderer") || CommandLineFlag("-botc-ai-polish")) return true;
            if (PackageRequiresExplicitLocalLlmOptIn()) return false;
            if (settingsLocalLlmRenderer) return true;
            if (PlayerPrefs.HasKey(SettingsLocalLlmRendererKey)) return false;
            return PackageEnablesLocalLlmRenderer();
        }


        private bool PackageEnablesLocalLlmRenderer()
        {
            var root = PackageRootPath();
            var candidates = new[]
            {
                Path.Combine(root, "botc_ai_polish.enabled"),
                Path.Combine(root, "LocalLLM", "enable_ai_polish.flag"),
                Path.Combine(Application.streamingAssetsPath, "botc_ai_polish.enabled"),
            };
            return candidates.Any((candidate) => File.Exists(candidate));
        }


        private bool PackageRequiresExplicitLocalLlmOptIn()
        {
            return !PackageEnablesLocalLlmRenderer()
                && string.Equals(PackageLocalLlmTier(), "tiny", StringComparison.OrdinalIgnoreCase);
        }


        private string PackageLocalLlmTier()
        {
            var manifestPath = Path.Combine(PackageRootPath(), "LocalLLM", "LOCAL_LLM_MANIFEST.json");
            if (!File.Exists(manifestPath)) return "";
            try
            {
                var manifest = JsonUtility.FromJson<LocalLlmManifest>(File.ReadAllText(manifestPath));
                return manifest?.model?.tier?.Trim() ?? "";
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to read LocalLLM manifest tier from {manifestPath}: {ex.Message}");
                return "";
            }
        }


        private string PackageRootPath()
        {
            return Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
        }


        private void ClearBridgeLLMEnvironment(DiagnosticsProcessStartInfo startInfo)
        {
            if (startInfo == null) return;
            startInfo.EnvironmentVariables.Remove("BOTC_LLM_RENDERER");
            startInfo.EnvironmentVariables.Remove("BOTC_LLM_PROVIDER");
            startInfo.EnvironmentVariables.Remove("BOTC_LLM_ENDPOINT");
            startInfo.EnvironmentVariables.Remove("BOTC_LLM_MODEL");
            startInfo.EnvironmentVariables.Remove("BOTC_LLM_OLLAMA_MODEL");
            startInfo.EnvironmentVariables.Remove("BOTC_LLM_OLLAMA_ENDPOINT");
            startInfo.EnvironmentVariables.Remove("BOTC_LLM_TIMEOUT_MS");
        }


        private void SetOpenAICompatibleBridgeEnvironment(DiagnosticsProcessStartInfo startInfo, string endpoint, string model, string timeoutMs)
        {
            startInfo.EnvironmentVariables["BOTC_LLM_RENDERER"] = "1";
            startInfo.EnvironmentVariables["BOTC_LLM_PROVIDER"] = "openai-compatible";
            startInfo.EnvironmentVariables["BOTC_LLM_ENDPOINT"] = endpoint;
            startInfo.EnvironmentVariables["BOTC_LLM_MODEL"] = string.IsNullOrWhiteSpace(model) ? "embedded-local-model" : model;
            startInfo.EnvironmentVariables["BOTC_LLM_TIMEOUT_MS"] = string.IsNullOrWhiteSpace(timeoutMs) ? DefaultEmbeddedLocalLlmTimeoutMs.ToString() : timeoutMs;
        }


        private string StartEmbeddedLocalLlmIfAvailable()
        {
            if (!ShouldUseLocalLlmRenderer()) return "";
            if (localLlmProcessStartedByUnity && localLlmProcess != null)
            {
                try
                {
                    if (!localLlmProcess.HasExited && !string.IsNullOrWhiteSpace(localLlmEndpoint)) return localLlmEndpoint;
                }
                catch
                {
                    localLlmProcess = null;
                    localLlmProcessStartedByUnity = false;
                    localLlmEndpoint = "";
                }
            }

            var root = FindEmbeddedLocalLlmRoot();
            if (string.IsNullOrWhiteSpace(root)) return "";

            var server = FindEmbeddedLocalLlmServer(root);
            localLlmModelPath = FindEmbeddedLocalLlmModel(root);
            if (string.IsNullOrWhiteSpace(server) || string.IsNullOrWhiteSpace(localLlmModelPath)) return "";

            var port = EmbeddedLocalLlmPort();
            localLlmEndpoint = $"http://127.0.0.1:{port}/v1/chat/completions";
            var args = "--host 127.0.0.1"
                + $" --port {port}"
                + " -m " + QuoteProcessArgument(localLlmModelPath)
                + $" -c {EmbeddedLocalLlmContext()}";
            var extraArgs = Environment.GetEnvironmentVariable("BOTC_EMBEDDED_LLM_ARGS");
            var cliExtraArgs = CommandLineValue("-botc-llm-args");
            if (!string.IsNullOrWhiteSpace(cliExtraArgs)) extraArgs = cliExtraArgs;
            if (!string.IsNullOrWhiteSpace(extraArgs)) args += " " + extraArgs;

            try
            {
                localLlmProcess = new DiagnosticsProcess
                {
                    StartInfo = new DiagnosticsProcessStartInfo
                    {
                        FileName = server,
                        Arguments = args,
                        WorkingDirectory = root,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden
                    },
                    EnableRaisingEvents = false
                };
                localLlmProcess.Start();
                localLlmProcessStartedByUnity = true;
                var readyTimeoutMs = EmbeddedLocalLlmReadyTimeout();
                if (WaitForEmbeddedLocalLlmReady(port, readyTimeoutMs))
                {
                    Debug.Log($"Embedded local LLM server started from {server} using {localLlmModelPath}");
                }
                else
                {
                    Debug.LogWarning($"Embedded local LLM server started but was not reachable within {readyTimeoutMs}ms. Dialogue polish may use fallback for early lines.");
                }
                return localLlmEndpoint;
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to start embedded local LLM server. Falling back to external provider. {ex.Message}");
                localLlmProcess?.Dispose();
                localLlmProcess = null;
                localLlmProcessStartedByUnity = false;
                localLlmEndpoint = "";
                return "";
            }
        }


        private string FindEmbeddedLocalLlmRoot()
        {
            var explicitRoot = CommandLineValue("-botc-llm-root");
            if (string.IsNullOrWhiteSpace(explicitRoot)) explicitRoot = Environment.GetEnvironmentVariable("BOTC_EMBEDDED_LLM_ROOT");
            if (!string.IsNullOrWhiteSpace(explicitRoot))
            {
                var resolved = ResolveMaybeRelativePath(explicitRoot, Path.GetFullPath(Path.Combine(Application.dataPath, "..")));
                if (Directory.Exists(resolved)) return resolved;
            }

            var candidates = new[]
            {
                Path.GetFullPath(Path.Combine(Application.dataPath, "..", "LocalLLM")),
                Path.GetFullPath(Path.Combine(Application.streamingAssetsPath, "LocalLLM")),
                Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "LocalLLM")),
                Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "third_party", "LocalLLM")),
            };
            return candidates.FirstOrDefault((candidate) => Directory.Exists(candidate)) ?? "";
        }


        private string FindEmbeddedLocalLlmServer(string root)
        {
            if (string.IsNullOrWhiteSpace(root)) return "";
            var explicitServer = CommandLineValue("-botc-llm-server");
            if (string.IsNullOrWhiteSpace(explicitServer)) explicitServer = Environment.GetEnvironmentVariable("BOTC_EMBEDDED_LLM_SERVER");
            if (!string.IsNullOrWhiteSpace(explicitServer))
            {
                var resolved = ResolveMaybeRelativePath(explicitServer, root);
                if (File.Exists(resolved)) return resolved;
            }

            var candidates = new[]
            {
                Path.Combine(root, "llama-server.exe"),
                Path.Combine(root, "bin", "llama-server.exe"),
                Path.Combine(root, "llama.cpp", "llama-server.exe"),
                Path.Combine(root, "llama.cpp", "build", "bin", "Release", "llama-server.exe"),
            };
            return candidates.FirstOrDefault((candidate) => File.Exists(candidate)) ?? "";
        }


        private string FindEmbeddedLocalLlmModel(string root)
        {
            if (string.IsNullOrWhiteSpace(root)) return "";
            var explicitModel = CommandLineValue("-botc-llm-model");
            if (string.IsNullOrWhiteSpace(explicitModel)) explicitModel = Environment.GetEnvironmentVariable("BOTC_EMBEDDED_LLM_MODEL");
            if (!string.IsNullOrWhiteSpace(explicitModel))
            {
                var resolved = ResolveMaybeRelativePath(explicitModel, root);
                if (File.Exists(resolved)) return resolved;
            }

            var modelsDir = Path.Combine(root, "models");
            if (!Directory.Exists(modelsDir)) return "";
            try
            {
                return Directory.GetFiles(modelsDir, "*.gguf", SearchOption.TopDirectoryOnly)
                    .OrderBy((candidate) => Path.GetFileName(candidate).IndexOf("qwen", StringComparison.OrdinalIgnoreCase) >= 0 ? 0 : 1)
                    .ThenBy((candidate) => candidate, StringComparer.OrdinalIgnoreCase)
                    .FirstOrDefault() ?? "";
            }
            catch
            {
                return "";
            }
        }


        private int EmbeddedLocalLlmPort()
        {
            var value = CommandLineValue("-botc-llm-port");
            if (string.IsNullOrWhiteSpace(value)) value = Environment.GetEnvironmentVariable("BOTC_EMBEDDED_LLM_PORT");
            int parsed;
            return int.TryParse(value, out parsed) && parsed > 0 ? parsed : DefaultEmbeddedLocalLlmPort;
        }


        private int EmbeddedLocalLlmContext()
        {
            var value = CommandLineValue("-botc-llm-context");
            if (string.IsNullOrWhiteSpace(value)) value = Environment.GetEnvironmentVariable("BOTC_EMBEDDED_LLM_CONTEXT");
            int parsed;
            return int.TryParse(value, out parsed) && parsed > 0 ? parsed : DefaultEmbeddedLocalLlmContext;
        }


        private int EmbeddedLocalLlmReadyTimeout()
        {
            var value = CommandLineValue("-botc-llm-ready-timeout");
            if (string.IsNullOrWhiteSpace(value)) value = Environment.GetEnvironmentVariable("BOTC_EMBEDDED_LLM_READY_TIMEOUT_MS");
            int parsed;
            return int.TryParse(value, out parsed) && parsed >= 0 ? parsed : DefaultEmbeddedLocalLlmReadyTimeoutMs;
        }


        private bool WaitForEmbeddedLocalLlmReady(int port, int timeoutMs)
        {
            if (timeoutMs <= 0) return true;
            var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    if (localLlmProcess != null && localLlmProcess.HasExited)
                    {
                        return false;
                    }
                }
                catch
                {
                    return false;
                }

                if (CanConnectToLocalLlm(port)) return true;
                Thread.Sleep(EmbeddedLocalLlmReadyPollMs);
            }
            return false;
        }


        private bool CanConnectToLocalLlm(int port)
        {
            try
            {
                using (var client = new TcpClient())
                {
                    var connect = client.BeginConnect("127.0.0.1", port, null, null);
                    try
                    {
                        if (!connect.AsyncWaitHandle.WaitOne(250)) return false;
                        client.EndConnect(connect);
                        return true;
                    }
                    finally
                    {
                        connect.AsyncWaitHandle.Close();
                    }
                }
            }
            catch
            {
                return false;
            }
        }


        private string ResolveMaybeRelativePath(string value, string baseDirectory)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            return Path.IsPathRooted(value) ? value : Path.GetFullPath(Path.Combine(baseDirectory, value));
        }


        private void RestartBridgeAfterLLMSettingChange()
        {
            if (Application.isEditor || CommandLineFlag("-botc-no-bridge"))
            {
                return;
            }
            if (!bridgeProcessStartedByUnity)
            {
                return;
            }
            StopUnityBridgeProcess();
            if (!ShouldUseLocalLlmRenderer()) StopLocalLlmProcess();
            StartUnityBridgeIfAvailable();
        }


        private void UpdateBridgeProcessStatus()
        {
            if (!bridgeProcessStartedByUnity || bridgeProcess == null) return;

            try
            {
                if (!bridgeProcess.HasExited) return;
                bridgeLaunchStatus = $"同步：本地连接已退出 {bridgeProcess.ExitCode}";
                bridgeLaunchProblem = true;
                bridgeProcess.Dispose();
                bridgeProcess = null;
                bridgeProcessStartedByUnity = false;
            }
            catch (Exception ex)
            {
                bridgeLaunchStatus = "同步：本地连接状态未知";
                Debug.LogWarning($"Failed to inspect Unity action bridge process: {ex.Message}");
            }
        }


        private void StopUnityBridgeProcess()
        {
            if (!bridgeProcessStartedByUnity || bridgeProcess == null) return;

            try
            {
                if (!bridgeProcess.HasExited)
                {
                    bridgeProcess.Kill();
                    bridgeProcess.WaitForExit(600);
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to stop Unity action bridge process: {ex.Message}");
            }
            finally
            {
                bridgeProcess.Dispose();
                bridgeProcess = null;
                bridgeProcessStartedByUnity = false;
            }
        }


        private void StopLocalLlmProcess()
        {
            if (!localLlmProcessStartedByUnity || localLlmProcess == null) return;

            try
            {
                if (!localLlmProcess.HasExited)
                {
                    localLlmProcess.Kill();
                    localLlmProcess.WaitForExit(900);
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to stop embedded local LLM process: {ex.Message}");
            }
            finally
            {
                localLlmProcess.Dispose();
                localLlmProcess = null;
                localLlmProcessStartedByUnity = false;
                localLlmEndpoint = "";
                localLlmModelPath = "";
            }
        }


        private static string QuoteProcessArgument(string value)
        {
            return "\"" + (value ?? "").Replace("\"", "\\\"") + "\"";
        }


        private static bool CommandLineFlag(string name)
        {
            return Environment.GetCommandLineArgs().Any((arg) => string.Equals(arg, name, StringComparison.OrdinalIgnoreCase));
        }


        private static string CommandLineValue(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length; i++)
            {
                if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length) return args[i + 1];
                if (args[i].StartsWith(name + "=", StringComparison.OrdinalIgnoreCase)) return args[i].Substring(name.Length + 1);
            }
            return "";
        }


        private bool HasPendingAction()
        {
            return !string.IsNullOrWhiteSpace(pendingActionId) && pendingActionStartedAt >= 0f;
        }


        private float PendingActionElapsed()
        {
            return HasPendingAction() ? Mathf.Max(0f, Time.realtimeSinceStartup - pendingActionStartedAt) : 0f;
        }


        private bool PendingActionTimedOut()
        {
            return HasPendingAction() && PendingActionElapsed() >= BridgeSlowWarningSeconds;
        }


        private bool PendingActionExpired()
        {
            return HasPendingAction() && PendingActionElapsed() >= BridgeStaleActionSeconds;
        }


        private void ShowPendingActionBusyMessage(string nextType)
        {
            var currentLabel = ActionTypeLabel(pendingActionType);
            var nextLabel = ActionTypeLabel(nextType);
            var elapsed = PendingActionElapsed();
            if (dialogueTitle != null) dialogueTitle.text = "同步中";
            if (dialogueBody != null)
            {
                dialogueBody.text = ClampTextBlock(
                    $"正在等待上一条{currentLabel}完成（{elapsed:0.0}s）。本地语言模型可能还在润色对话；完成前先不发送新的{nextLabel}，避免私聊、公聊或阶段推进串在一起。",
                    4,
                    48
                );
            }
            privateChatStatus = $"等待上一条{currentLabel}完成；请稍后再发送新的{nextLabel}。";
            UpdatePrivateChatPanelText();
            UpdateSyncStatusText();
        }


        private PrototypeViewModel LoadViewModel()
        {
            try
            {
                ConfigureBridgePaths();
                var samplePath = Path.Combine(Application.streamingAssetsPath, "sample_viewmodel.json");
                var path = File.Exists(viewModelPath) ? viewModelPath : samplePath;
                if (File.Exists(path))
                {
                    var json = ReadBridgeTextWithRetry(path);
                    var loaded = JsonUtility.FromJson<PrototypeViewModel>(json);
                    if (loaded != null && loaded.players != null && loaded.players.Length > 0) return loaded;
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to load Unity viewmodel: {ex.Message}");
            }
            return PrototypeViewModel.CreateFallback();
        }


        private void RememberViewModelTimestamp()
        {
            try
            {
                if (string.IsNullOrWhiteSpace(viewModelPath)) ConfigureBridgePaths();
                viewModelLastWriteUtc = File.Exists(viewModelPath) ? File.GetLastWriteTimeUtc(viewModelPath) : DateTime.MinValue;
            }
            catch
            {
                viewModelLastWriteUtc = DateTime.MinValue;
            }
        }


        private void PollViewModelChanges()
        {
            try
            {
                if (string.IsNullOrWhiteSpace(viewModelPath)) ConfigureBridgePaths();
                if (!File.Exists(viewModelPath)) return;
                var modified = File.GetLastWriteTimeUtc(viewModelPath);
                var pendingPollDue = HasPendingAction() && Time.realtimeSinceStartup >= nextPendingViewModelPollAt;
                if (modified <= viewModelLastWriteUtc && !pendingPollDue) return;
                if (pendingPollDue) nextPendingViewModelPollAt = Time.realtimeSinceStartup + PendingViewModelPollSeconds;
                if (modified > viewModelLastWriteUtc) viewModelLastWriteUtc = modified;
                var json = ReadBridgeTextWithRetry(viewModelPath);
                var loaded = JsonUtility.FromJson<PrototypeViewModel>(json);
                if (loaded == null || loaded.players == null || loaded.players.Length == 0) return;
                var previousPhaseKey = lastPhaseTransitionKey;
                var nextPhaseKey = PhaseTransitionKey(loaded);
                var phaseChanged = !string.IsNullOrWhiteSpace(previousPhaseKey)
                    && !string.IsNullOrWhiteSpace(nextPhaseKey)
                    && previousPhaseKey != nextPhaseKey;
                var previousTimelineKey = lastTimelineNarrationKey;
                var nextTimelineKey = LatestTimelineNarrationKey(loaded);
                var previousPrivateInfoKey = lastPrivateInfoNarrationKey;
                var nextPrivateInfoKey = PrivateInfoNarrationKey(loaded);
                var previousNightActionKey = lastNightActionNarrationKey;
                var nextNightActionKey = NightActionNarrationKey(loaded);
                var previousNominationDebateKey = lastNominationDebateNarrationKey;
                var nextNominationDebateKey = NominationDebateNarrationKey(loaded);
                var previousVoteCeremonyKey = lastVoteCeremonyNarrationKey;
                var nextVoteCeremonyKey = VoteCeremonyNarrationKey(loaded);
                var previousActionStatusKey = lastActionStatusNarrationKey;
                var nextActionStatusKey = ActionStatusNarrationKey(loaded);
                vm = loaded;
                lastPhaseTransitionKey = nextPhaseKey;
                lastTimelineNarrationKey = nextTimelineKey;
                lastPrivateInfoNarrationKey = nextPrivateInfoKey;
                lastNightActionNarrationKey = nextNightActionKey;
                lastNominationDebateNarrationKey = nextNominationDebateKey;
                lastVoteCeremonyNarrationKey = nextVoteCeremonyKey;
                lastActionStatusNarrationKey = nextActionStatusKey;
                if (vm.action != null && !string.IsNullOrWhiteSpace(vm.action.selectedPlayerId))
                {
                    selectedPlayerId = vm.action.selectedPlayerId;
                }
                ResolvePendingActionFromViewModel();
                RenderAllAndMood();
                if (phaseChanged)
                {
                    if (ShouldNarrateNightInfoBeforePhaseTransition(previousPhaseKey, nextPhaseKey, previousPrivateInfoKey, nextPrivateInfoKey))
                    {
                        CapturePostPhaseNarration(
                            previousTimelineKey,
                            nextTimelineKey,
                            nextPrivateInfoKey,
                            nextPrivateInfoKey,
                            previousNightActionKey,
                            nextNightActionKey
                        );
                        MaybeQueueNightStorytellerNarration(previousPrivateInfoKey, nextPrivateInfoKey, previousNightActionKey, nextNightActionKey);
                        QueuePhaseTransitionAfterDialogue(nextPhaseKey, false);
                    }
                    else
                    {
                        CapturePostPhaseNarration(
                            previousTimelineKey,
                            nextTimelineKey,
                            previousPrivateInfoKey,
                            nextPrivateInfoKey,
                            previousNightActionKey,
                            nextNightActionKey
                        );
                        BeginPhaseTransition(nextPhaseKey, false);
                    }
                }
                else
                {
                    MaybeQueueNightStorytellerNarration(previousPrivateInfoKey, nextPrivateInfoKey, previousNightActionKey, nextNightActionKey);
                    MaybeQueueTimelineNarration(previousTimelineKey, nextTimelineKey);
                }
                MaybeQueueNominationDebateNarration(previousNominationDebateKey, nextNominationDebateKey);
                MaybeQueueVoteCeremonyNarration(previousVoteCeremonyKey, nextVoteCeremonyKey);
                MaybeQueueActionStatusNarration(previousActionStatusKey, nextActionStatusKey);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to refresh Unity viewmodel: {ex.Message}");
            }
        }


        private bool SendUnityAction(string type, string playerId = "", string stage = "", string text = "", string intent = "", string reminder = "", string roleId = "", string claimRoleId = "", string nightInfo = "", bool askSecret = false, string mode = "", IEnumerable<string> targetIds = null, string guessPlayerId = "", string guessRoleId = "", IEnumerable<ActionGuessSelection> guesses = null, bool trackPending = true, string scriptId = "", int playerCount = 0, string offerId = "", bool? humanVoteYes = null, string tab = "", bool? toNight = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(actionPath)) ConfigureBridgePaths();
                if (HasPendingAction())
                {
                    if (PendingActionExpired())
                    {
                        ClearPendingAction();
                    }
                    else if (trackPending)
                    {
                        ShowPendingActionBusyMessage(type);
                        return false;
                    }
                }
                var directory = Path.GetDirectoryName(actionPath);
                if (!string.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
                var id = $"unity-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{UnityEngine.Random.Range(1000, 9999)}";
                var payload = new List<string>();
                if (!string.IsNullOrWhiteSpace(playerId))
                {
                    payload.Add($"\"playerId\":\"{JsonEscape(playerId)}\"");
                    payload.Add($"\"targetId\":\"{JsonEscape(playerId)}\"");
                    payload.Add($"\"nomineeId\":\"{JsonEscape(playerId)}\"");
                }
                if (!string.IsNullOrWhiteSpace(stage)) payload.Add($"\"stage\":\"{JsonEscape(stage)}\"");
                if (!string.IsNullOrWhiteSpace(text)) payload.Add($"\"text\":\"{JsonEscape(text)}\"");
                if (!string.IsNullOrWhiteSpace(intent)) payload.Add($"\"intent\":\"{JsonEscape(intent)}\"");
                if (!string.IsNullOrWhiteSpace(reminder)) payload.Add($"\"reminder\":\"{JsonEscape(reminder)}\"");
                if (!string.IsNullOrWhiteSpace(roleId)) payload.Add($"\"roleId\":\"{JsonEscape(roleId)}\"");
                if (!string.IsNullOrWhiteSpace(claimRoleId)) payload.Add($"\"claimRoleId\":\"{JsonEscape(claimRoleId)}\"");
                if (!string.IsNullOrWhiteSpace(nightInfo)) payload.Add($"\"nightInfo\":\"{JsonEscape(nightInfo)}\"");
                if (!string.IsNullOrWhiteSpace(scriptId)) payload.Add($"\"scriptId\":\"{JsonEscape(scriptId)}\"");
                if (!string.IsNullOrWhiteSpace(offerId)) payload.Add($"\"offerId\":\"{JsonEscape(offerId)}\"");
                if (playerCount > 0) payload.Add($"\"playerCount\":{Mathf.Clamp(playerCount, 5, 15)}");
                if (askSecret) payload.Add("\"askSecret\":true");
                if (humanVoteYes.HasValue) payload.Add($"\"humanVoteYes\":{(humanVoteYes.Value ? "true" : "false")}");
                if (toNight.HasValue) payload.Add($"\"toNight\":{(toNight.Value ? "true" : "false")}");
                if (!string.IsNullOrWhiteSpace(mode)) payload.Add($"\"mode\":\"{JsonEscape(mode)}\"");
                if (!string.IsNullOrWhiteSpace(tab)) payload.Add($"\"tab\":\"{JsonEscape(tab)}\"");
                var targetIdList = (targetIds ?? Array.Empty<string>()).Where((entry) => !string.IsNullOrWhiteSpace(entry)).Distinct().ToArray();
                if (targetIdList.Length > 0)
                {
                    payload.Add($"\"targetIds\":[{string.Join(",", targetIdList.Select((entry) => $"\"{JsonEscape(entry)}\""))}]");
                }
                var guessList = (guesses ?? Array.Empty<ActionGuessSelection>())
                    .Where((entry) => entry != null && !string.IsNullOrWhiteSpace(entry.playerId) && !string.IsNullOrWhiteSpace(entry.roleId))
                    .Select((entry) => $"{{\"playerId\":\"{JsonEscape(entry.playerId)}\",\"roleId\":\"{JsonEscape(entry.roleId)}\"}}")
                    .ToArray();
                if (guessList.Length > 0)
                {
                    payload.Add($"\"guesses\":[{string.Join(",", guessList)}]");
                }
                else if (!string.IsNullOrWhiteSpace(guessPlayerId) && !string.IsNullOrWhiteSpace(guessRoleId))
                {
                    payload.Add($"\"guesses\":[{{\"playerId\":\"{JsonEscape(guessPlayerId)}\",\"roleId\":\"{JsonEscape(guessRoleId)}\"}}]");
                }
                var json = "{\n"
                    + $"  \"id\": \"{id}\",\n"
                    + $"  \"type\": \"{JsonEscape(type)}\",\n"
                    + $"  \"createdAt\": \"{DateTime.UtcNow:O}\",\n"
                    + "  \"payload\": { " + string.Join(", ", payload) + " }\n"
                    + "}\n";
                var lockPath = "";
                try
                {
                    lockPath = AcquireActionFileLock(actionPath);
                    WriteBridgeTextAtomicWithRetry(actionPath, json);
                }
                finally
                {
                    ReleaseActionFileLock(lockPath);
                }
                if (trackPending)
                {
                    TrackPendingAction(id, type, playerId);
                }
                else
                {
                    if (PendingActionExpired()) ClearPendingAction();
                    UpdateSyncStatusText();
                }
                return true;
            }
            catch (Exception ex)
            {
                pendingActionId = "";
                pendingActionType = "";
                pendingActionPlayerId = "";
                pendingActionStartedAt = -1f;
                nextPendingViewModelPollAt = -1f;
                privateChatStatus = $"发送失败：{ex.Message}";
                UpdatePrivateChatPanelText();
                UpdateSyncStatusText();
                Debug.LogWarning($"Failed to write Unity action: {ex.Message}");
                return false;
            }
        }


        private static bool IsTransientBridgeFileError(Exception ex)
        {
            return ex is IOException || ex is UnauthorizedAccessException;
        }


        private static string ReadBridgeTextWithRetry(string path)
        {
            Exception lastError = null;
            for (var attempt = 0; attempt < BridgeFileRetryCount; attempt++)
            {
                try
                {
                    return File.ReadAllText(path);
                }
                catch (Exception ex) when (IsTransientBridgeFileError(ex))
                {
                    lastError = ex;
                    System.Threading.Thread.Sleep(Mathf.Min(250, BridgeFileRetryBaseMs + attempt * 10));
                }
            }
            throw lastError ?? new IOException($"Failed to read bridge file: {path}");
        }


        private static void WriteBridgeTextAtomicWithRetry(string path, string text)
        {
            var directory = Path.GetDirectoryName(path);
            if (!string.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
            Exception lastError = null;
            for (var attempt = 0; attempt < BridgeFileRetryCount; attempt++)
            {
                var tempPath = $"{path}.{Guid.NewGuid():N}.tmp";
                try
                {
                    File.WriteAllText(tempPath, text);
                    if (File.Exists(path)) File.Replace(tempPath, path, null);
                    else File.Move(tempPath, path);
                    return;
                }
                catch (Exception ex) when (IsTransientBridgeFileError(ex))
                {
                    lastError = ex;
                    try { if (File.Exists(tempPath)) File.Delete(tempPath); } catch { }
                    System.Threading.Thread.Sleep(Mathf.Min(250, BridgeFileRetryBaseMs + attempt * 10));
                }
                catch
                {
                    try { if (File.Exists(tempPath)) File.Delete(tempPath); } catch { }
                    throw;
                }
            }
            throw lastError ?? new IOException($"Failed to write bridge file: {path}");
        }


        private static void RemoveStaleActionFileLock(string lockPath)
        {
            try
            {
                if (!File.Exists(lockPath) && !Directory.Exists(lockPath)) return;
                var lastWrite = File.GetLastWriteTimeUtc(lockPath);
                if ((DateTime.UtcNow - lastWrite).TotalMilliseconds < BridgeActionLockStaleMs) return;
                if (File.Exists(lockPath)) File.Delete(lockPath);
                else Directory.Delete(lockPath, true);
            }
            catch
            {
            }
        }


        private static string AcquireActionFileLock(string targetPath)
        {
            var lockPath = targetPath + ".lock";
            var deadline = DateTime.UtcNow.AddMilliseconds(BridgeActionLockTimeoutMs);
            Exception lastError = null;
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    using (var stream = new FileStream(lockPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                    {
                        var owner = System.Text.Encoding.UTF8.GetBytes(
                            "{"
                            + $"\"pid\":{DiagnosticsProcess.GetCurrentProcess().Id},"
                            + $"\"acquiredAt\":\"{DateTime.UtcNow:O}\","
                            + "\"owner\":\"unity\""
                            + "}"
                        );
                        stream.Write(owner, 0, owner.Length);
                    }
                    return lockPath;
                }
                catch (Exception ex) when (IsTransientBridgeFileError(ex))
                {
                    lastError = ex;
                    RemoveStaleActionFileLock(lockPath);
                    System.Threading.Thread.Sleep(BridgeActionLockRetryMs);
                }
            }
            throw new IOException($"Unity action bridge lock is busy: {lockPath}", lastError);
        }


        private static void ReleaseActionFileLock(string lockPath)
        {
            if (string.IsNullOrWhiteSpace(lockPath)) return;
            try
            {
                if (File.Exists(lockPath)) File.Delete(lockPath);
            }
            catch
            {
            }
        }


        private void TrackPendingAction(string id, string type, string playerId)
        {
            pendingActionId = id;
            pendingActionType = type;
            pendingActionPlayerId = playerId ?? "";
            pendingActionStartedAt = Time.realtimeSinceStartup;
            nextPendingViewModelPollAt = Time.realtimeSinceStartup + 0.2f;
            UpdateSyncStatusText();
        }


        private void ClearPendingAction()
        {
            pendingActionId = "";
            pendingActionType = "";
            pendingActionPlayerId = "";
            pendingActionStartedAt = -1f;
            nextPendingViewModelPollAt = -1f;
        }


        private void ResolvePendingActionFromViewModel()
        {
            if (!HasPendingAction() || vm?.action == null || vm.action.lastActionId != pendingActionId) return;
            var completedType = pendingActionType;
            var ok = !string.Equals(vm.action.status, "error", StringComparison.OrdinalIgnoreCase);
            var message = string.IsNullOrWhiteSpace(vm.action.message) ? "界面已刷新。" : vm.action.message;
            ClearPendingAction();

            if (completedType == "auto-advance")
            {
                if (ok) FocusAutoAdvanceStop();
            }
            else if (completedType == "night-action")
            {
                if (ok) FocusCompletedNightAction();
            }
            else if (completedType == "storyteller-action")
            {
                if (ok) FocusCompletedStorytellerAction();
            }
            else if (completedType == "phase" || completedType == "pass-nomination-window")
            {
                if (ok) FocusCompletedFlowAdvance();
            }
            else if (completedType == "private-chat" || completedType == "private-preset" || completedType == "accept-proactive-whisper")
            {
                privateChatStatus = ok ? "对方已回应；最近私聊已更新。" : $"同步错误：{message}";
                UpdatePrivateChatPanelText();
            }
            else if (completedType == "resolve-nomination-vote")
            {
                if (ok && vm?.voteCeremony != null) RestartVoteAnimation();
            }
            else if (completedType == "day-action")
            {
                if (ok && vm.action.publicAction)
                {
                    dialogueTitle.text = vm.action.resolvedImmediately ? "公开发动已结算" : "公开发动已记录";
                    dialogueBody.text = FirstNonEmpty(message, "公开时间线已更新。");
                }
                else if (!ok)
                {
                    dialogueTitle.text = "公开发动失败";
                    dialogueBody.text = message;
                }
            }
            else if (completedType == "decline-proactive-whisper")
            {
                RenderProactiveWhisperPanel();
            }
        }

        private void FocusAutoAdvanceStop()
        {
            var auto = vm?.action?.autoAdvance;
            var stoppedAt = auto?.stoppedAt ?? "";
            if (stoppedAt == "storyteller-action")
            {
                OpenStorytellerPanel();
                return;
            }
            if (stoppedAt == "human-night-action")
            {
                OpenActionFormPanel("night-action");
                return;
            }
            if (stoppedAt == "human-day-action")
            {
                OpenActionFormPanel("day-action");
                return;
            }
            if (stoppedAt == "nomination-debate")
            {
                RenderNominationDebatePanel();
            }
        }

        private void FocusCompletedNightAction()
        {
            CloseActionFormPanel();
            if (vm?.pendingStorytellerAction != null && vm.pendingStorytellerAction.available)
            {
                OpenStorytellerPanel();
            }
        }

        private void FocusCompletedStorytellerAction()
        {
            if (vm?.pendingStorytellerAction != null && vm.pendingStorytellerAction.available)
            {
                OpenStorytellerPanel();
                return;
            }
            CloseStorytellerPanel();
            if (vm?.phase == "night" && vm.humanNightAction != null && vm.humanNightAction.available)
            {
                OpenActionFormPanel("night-action");
            }
        }

        private void FocusCompletedFlowAdvance()
        {
            if (vm?.pendingStorytellerAction != null && vm.pendingStorytellerAction.available)
            {
                OpenStorytellerPanel();
                return;
            }
            if (vm?.phase == "night" && vm.humanNightAction != null && vm.humanNightAction.available)
            {
                OpenActionFormPanel("night-action");
            }
        }


        private static string JsonEscape(string value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
        }
    }
}
