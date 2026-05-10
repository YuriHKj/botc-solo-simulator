using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace BotcSolo.UnityPrototype.Editor
{
    public static class BotcPrototypeBuild
    {
        [MenuItem("BOTC Solo/Build Windows Prototype")]
        public static void BuildWindows()
        {
            const string scenePath = "Assets/Scenes/Prototype.unity";
            if (!File.Exists(scenePath))
            {
                throw new FileNotFoundException($"Prototype scene not found: {scenePath}");
            }

            SyncAssetsFromElectronSource();
            SyncJsCoreForSelfBootstrap();
            SyncNodeRuntimeForSelfBootstrap();
            ConfigurePlayerWindowDefaults();

            var outputDir = Path.GetFullPath("../unity-build");
            Directory.CreateDirectory(outputDir);
            var outputPath = Path.Combine(outputDir, "BOTC_Unity_Prototype.exe");

            var options = new BuildPlayerOptions
            {
                scenes = new[] { scenePath },
                locationPathName = outputPath,
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None
            };

            var report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                throw new System.Exception($"Unity prototype build failed: {report.summary.result}");
            }
            Debug.Log($"Unity prototype build succeeded: {outputPath}");
        }

        private static void ConfigurePlayerWindowDefaults()
        {
            PlayerSettings.fullScreenMode = FullScreenMode.FullScreenWindow;
            PlayerSettings.defaultScreenWidth = 1920;
            PlayerSettings.defaultScreenHeight = 1080;
            PlayerSettings.resizableWindow = true;
        }

        private static void SyncJsCoreForSelfBootstrap()
        {
            var projectRoot = Path.GetFullPath("..");
            var sourceScriptsRoot = Path.Combine(projectRoot, "scripts");
            var streamingRoot = Path.Combine("Assets", "StreamingAssets", "BotcJsCore");
            var targetScriptsRoot = Path.Combine(streamingRoot, "scripts");

            if (!Directory.Exists(sourceScriptsRoot))
            {
                throw new DirectoryNotFoundException($"JS Core scripts root not found: {sourceScriptsRoot}");
            }

            if (Directory.Exists(targetScriptsRoot))
            {
                Directory.Delete(targetScriptsRoot, true);
            }
            Directory.CreateDirectory(targetScriptsRoot);

            foreach (var sourcePath in Directory.GetFiles(sourceScriptsRoot, "*.*", SearchOption.AllDirectories)
                .Where((path) => path.EndsWith(".js") || path.EndsWith(".mjs") || path.EndsWith(".json"))
                .OrderBy((path) => path))
            {
                var relative = MakeRelativePath(sourceScriptsRoot, sourcePath);
                var targetPath = Path.Combine(targetScriptsRoot, relative);
                var targetDir = Path.GetDirectoryName(targetPath);
                if (!string.IsNullOrEmpty(targetDir)) Directory.CreateDirectory(targetDir);
                File.Copy(sourcePath, targetPath, true);
            }

            Directory.CreateDirectory(streamingRoot);
            File.WriteAllText(
                Path.Combine(streamingRoot, "package.json"),
                "{\n  \"type\": \"module\",\n  \"private\": true\n}\n"
            );
            AssetDatabase.Refresh();
        }

        private static void SyncNodeRuntimeForSelfBootstrap()
        {
            var nodeExe = FindNodeExecutable();
            if (string.IsNullOrWhiteSpace(nodeExe) || !File.Exists(nodeExe))
            {
                throw new FileNotFoundException("node.exe was not found in PATH. Install Node.js or set BOTC_NODE_EXE before building the Unity self-contained prototype.");
            }

            var runtimeRoot = Path.Combine("Assets", "StreamingAssets", "BotcJsRuntime");
            Directory.CreateDirectory(runtimeRoot);
            File.Copy(nodeExe, Path.Combine(runtimeRoot, "node.exe"), true);
            File.WriteAllText(Path.Combine(runtimeRoot, "runtime.txt"), $"node={nodeExe}\n");
            Debug.Log($"Bundled Node runtime for Unity prototype: {nodeExe}");
            AssetDatabase.Refresh();
        }

        private static string FindNodeExecutable()
        {
            var explicitPath = System.Environment.GetEnvironmentVariable("BOTC_NODE_EXE");
            if (!string.IsNullOrWhiteSpace(explicitPath) && File.Exists(explicitPath)) return explicitPath;

            var pathEnv = System.Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (var entry in pathEnv.Split(Path.PathSeparator))
            {
                if (string.IsNullOrWhiteSpace(entry)) continue;
                var candidate = Path.Combine(entry.Trim(), "node.exe");
                if (File.Exists(candidate)) return candidate;
            }
            return "";
        }

        private static void SyncAssetsFromElectronSource()
        {
            var projectRoot = Path.GetFullPath("..");
            var sourceRoleRoot = Path.Combine(projectRoot, "assets", "roles");
            var sourceUiRoot = Path.Combine(projectRoot, "assets", "ui");
            var unityRoleRoot = Path.Combine("Assets", "Resources", "Botc", "roles");
            var unityUiRoot = Path.Combine("Assets", "Resources", "Botc", "ui");

            CopyRoleAssets(sourceRoleRoot, unityRoleRoot);
            CopyDirectoryPngs(sourceUiRoot, unityUiRoot);
            AssetDatabase.Refresh();
        }

        private static void CopyRoleAssets(string sourceRoleRoot, string unityRoleRoot)
        {
            if (!Directory.Exists(sourceRoleRoot))
            {
                throw new DirectoryNotFoundException($"Electron role asset root not found: {sourceRoleRoot}");
            }

            foreach (var scriptDir in Directory.GetDirectories(sourceRoleRoot).OrderBy(Path.GetFileName))
            {
                CopyDirectoryPngs(scriptDir, unityRoleRoot);
            }
        }

        private static void CopyDirectoryPngs(string sourceDir, string targetDir)
        {
            if (!Directory.Exists(sourceDir))
            {
                throw new DirectoryNotFoundException($"Asset source directory not found: {sourceDir}");
            }

            Directory.CreateDirectory(targetDir);
            foreach (var sourcePath in Directory.GetFiles(sourceDir, "*.png").OrderBy(Path.GetFileName))
            {
                var targetPath = Path.Combine(targetDir, Path.GetFileName(sourcePath));
                File.Copy(sourcePath, targetPath, true);
            }
        }

        private static string MakeRelativePath(string root, string path)
        {
            var rootUri = new System.Uri(Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar);
            var pathUri = new System.Uri(Path.GetFullPath(path));
            return System.Uri.UnescapeDataString(rootUri.MakeRelativeUri(pathUri).ToString()).Replace('/', Path.DirectorySeparatorChar);
        }
    }
}
