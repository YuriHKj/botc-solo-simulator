using System;
using System.Collections.Generic;
using DiagnosticsProcess = System.Diagnostics.Process;
using DiagnosticsProcessStartInfo = System.Diagnostics.ProcessStartInfo;
using System.IO;
using System.Linq;
using UnityEngine;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {
        private const int DefaultEmbeddedLocalLlmPort = 18080;
        private const int DefaultEmbeddedLocalLlmContext = 1024;
        private const int DefaultEmbeddedLocalLlmTimeoutMs = 2200;

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
                bridgeLaunchStatus = "同步：UI smoke 未启动 bridge";
                bridgeLaunchProblem = false;
                return;
            }

            if (Application.isEditor)
            {
                bridgeLaunchStatus = "同步：Editor 手动 bridge";
                bridgeLaunchProblem = false;
                return;
            }

            var bridgeScript = FindUnityBridgeScript();
            if (string.IsNullOrWhiteSpace(bridgeScript))
            {
                bridgeLaunchStatus = "同步：未找到 bridge";
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
                bridgeLaunchStatus = IsBundledNodeRuntime(nodeExecutable) ? "同步：内置 bridge 已启动" : "同步：bridge 已启动";
                Debug.Log($"Unity action bridge started from {bridgeScript} with {nodeExecutable}");
            }
            catch (Exception ex)
            {
                bridgeLaunchStatus = "同步：bridge 启动失败";
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
            return settingsLocalLlmRenderer
                || PackageEnablesLocalLlmRenderer()
                || CommandLineFlag("-botc-llm-renderer")
                || CommandLineFlag("-botc-ai-polish");
        }


        private bool PackageEnablesLocalLlmRenderer()
        {
            var root = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
            var candidates = new[]
            {
                Path.Combine(root, "botc_ai_polish.enabled"),
                Path.Combine(root, "LocalLLM", "enable_ai_polish.flag"),
                Path.Combine(Application.streamingAssetsPath, "botc_ai_polish.enabled"),
            };
            return candidates.Any((candidate) => File.Exists(candidate));
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
                Debug.Log($"Embedded local LLM server started from {server} using {localLlmModelPath}");
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
                bridgeLaunchStatus = $"同步：bridge 已退出 {bridgeProcess.ExitCode}";
                bridgeLaunchProblem = true;
                bridgeProcess.Dispose();
                bridgeProcess = null;
                bridgeProcessStartedByUnity = false;
            }
            catch (Exception ex)
            {
                bridgeLaunchStatus = "同步：bridge 状态未知";
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
            return HasPendingAction() && PendingActionElapsed() >= BridgeTimeoutSeconds;
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
                    var json = File.ReadAllText(path);
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
                var json = File.ReadAllText(viewModelPath);
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
                vm = loaded;
                lastPhaseTransitionKey = nextPhaseKey;
                lastTimelineNarrationKey = nextTimelineKey;
                lastPrivateInfoNarrationKey = nextPrivateInfoKey;
                lastNightActionNarrationKey = nextNightActionKey;
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
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to refresh Unity viewmodel: {ex.Message}");
            }
        }


        private void SendUnityAction(string type, string playerId = "", string stage = "", string text = "", string intent = "", string reminder = "", string roleId = "", string claimRoleId = "", string nightInfo = "", bool askSecret = false, string mode = "", IEnumerable<string> targetIds = null, string guessPlayerId = "", string guessRoleId = "", bool trackPending = true, string scriptId = "", int playerCount = 0, string offerId = "")
        {
            try
            {
                if (string.IsNullOrWhiteSpace(actionPath)) ConfigureBridgePaths();
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
                if (!string.IsNullOrWhiteSpace(mode)) payload.Add($"\"mode\":\"{JsonEscape(mode)}\"");
                var targetIdList = (targetIds ?? Array.Empty<string>()).Where((entry) => !string.IsNullOrWhiteSpace(entry)).Distinct().ToArray();
                if (targetIdList.Length > 0)
                {
                    payload.Add($"\"targetIds\":[{string.Join(",", targetIdList.Select((entry) => $"\"{JsonEscape(entry)}\""))}]");
                }
                if (!string.IsNullOrWhiteSpace(guessPlayerId) && !string.IsNullOrWhiteSpace(guessRoleId))
                {
                    payload.Add($"\"guesses\":[{{\"playerId\":\"{JsonEscape(guessPlayerId)}\",\"roleId\":\"{JsonEscape(guessRoleId)}\"}}]");
                }
                var json = "{\n"
                    + $"  \"id\": \"{id}\",\n"
                    + $"  \"type\": \"{JsonEscape(type)}\",\n"
                    + $"  \"createdAt\": \"{DateTime.UtcNow:O}\",\n"
                    + "  \"payload\": { " + string.Join(", ", payload) + " }\n"
                    + "}\n";
                File.WriteAllText(actionPath, json);
                if (trackPending)
                {
                    TrackPendingAction(id, type, playerId);
                }
                else
                {
                    if (PendingActionTimedOut()) ClearPendingAction();
                    UpdateSyncStatusText();
                }
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
            var message = string.IsNullOrWhiteSpace(vm.action.message) ? "JS Core 已刷新 viewmodel。" : vm.action.message;
            ClearPendingAction();

            if (completedType == "private-chat" || completedType == "private-preset" || completedType == "accept-proactive-whisper")
            {
                privateChatStatus = ok ? "对方已回应；最近私聊已更新。" : $"同步错误：{message}";
                UpdatePrivateChatPanelText();
            }
            else if (completedType == "resolve-nomination-vote")
            {
                if (ok && vm?.voteCeremony != null) OpenVotePanel();
            }
            else if (completedType == "decline-proactive-whisper")
            {
                RenderProactiveWhisperPanel();
            }
        }


        private static string JsonEscape(string value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
        }
    }
}
