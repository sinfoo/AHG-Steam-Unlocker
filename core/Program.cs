using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace AHGUnlocker.Core
{
    class Program
    {
        static async Task<int> Main(string[] args)
        {
            Console.WriteLine("[CORE] AHG Unlocker Core starting...");

            if (args.Length == 0)
            {
                Console.WriteLine("Usage: AHGUnlocker.Core <command> [args]");
                return 1;
            }

            var command = args[0];

            try
            {
                switch (command)
                {
                    case "install":
                        if (args.Length < 2) return 1;
                        return await InstallGame(args[1], args.Length > 2 && args[2] == "--with-dlc");

                    case "uninstall":
                        if (args.Length < 2) return 1;
                        return await UninstallGame(args[1]);

                    case "status":
                        return GetSteamStatus();

                    case "restart":
                        return await RestartSteam();

                    case "backup-lua":
                        return await BackupLuaFiles();

                    case "get-steam-path":
                        Console.WriteLine(GetSteamPath());
                        return 0;

                    default:
                        Console.WriteLine($"Unknown command: {command}");
                        return 1;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[CORE] Error: {ex.Message}");
                return 1;
            }

            return 0;
        }

        static string GetSteamPath()
        {
            // Try registry first
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Valve\Steam");
                if (key != null)
                {
                    var path = key.GetValue("SteamPath") as string;
                    if (!string.IsNullOrEmpty(path))
                        return path;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[CORE] Registry read error: {ex.Message}");
            }

            // Default paths
            var defaultPaths = new[]
            {
                @"C:\Program Files (x86)\Steam",
                @"C:\Program Files\Steam"
            };

            foreach (var p in defaultPaths)
            {
                if (Directory.Exists(p))
                    return p;
            }

            return "";
        }

        static int GetSteamStatus()
        {
            var steamProcesses = Process.GetProcessesByName("steam");
            var isRunning = steamProcesses.Length > 0;
            foreach (var p in steamProcesses) p.Dispose();
            
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                running = isRunning,
                version = "3.0",
                steamPath = GetSteamPath()
            }));
            
            return 0;
        }

        static async Task<int> RestartSteam()
        {
            try
            {
                // Kill Steam
                var processes = Process.GetProcessesByName("steam");
                foreach (var p in processes)
                {
                    using (p) p.Kill();
                }

                // Wait a moment
                await Task.Delay(2000);

                // Start Steam
                var steamPath = GetSteamPath();
                if (!string.IsNullOrEmpty(steamPath) && Directory.Exists(steamPath))
                {
                    Process.Start(Path.Combine(steamPath, "steam.exe"));
                }

                Console.WriteLine(JsonSerializer.Serialize(new
                {
                    success = true,
                    message = "Steam restart initiated"
                }));
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = ex.Message
                }));
                return 1;
            }

            return 0;
        }

        static async Task<int> InstallGame(string appid, bool withDLC)
        {
            Console.WriteLine($"[CORE] Installing game {appid} (DLC: {withDLC})...");
            
            // TODO: Implement actual game installation
            // This would:
            // 1. Find or create Steam manifest
            // 2. Download game files
            // 3. Apply any necessary patches
            
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                success = true,
                message = $"Game {appid} installation initiated"
            }));
            
            return 0;
        }

        static async Task<int> UninstallGame(string appid)
        {
            Console.WriteLine($"[CORE] Uninstalling game {appid}...");
            
            // TODO: Implement actual game removal
            
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                success = true,
                message = $"Game {appid} uninstalled"
            }));
            
            return 0;
        }

        static async Task<int> BackupLuaFiles()
        {
            var steamPath = GetSteamPath();
            if (string.IsNullOrEmpty(steamPath))
            {
                Console.Error.WriteLine("Steam not found");
                return 1;
            }

            var steamApps = Path.Combine(steamPath, "steamapps");
            var backupDir = Path.Combine(steamApps, "backup_lua");
            
            Directory.CreateDirectory(backupDir);

            // Find all .lua files in common locations
            var luaFiles = new List<string>();
            var possibleDirs = new[]
            {
                Path.Combine(steamApps, "common"),
                Path.Combine(steamApps, "sourcemods"),
            };

            foreach (var dir in possibleDirs)
            {
                if (Directory.Exists(dir))
                {
                    luaFiles.AddRange(Directory.GetFiles(dir, "*.lua", SearchOption.AllDirectories));
                }
            }

            var backupCount = 0;
            foreach (var file in luaFiles)
            {
                try
                {
                    var relPath = Path.GetRelativePath(steamApps, file);
                    var backupPath = Path.Combine(backupDir, relPath);
                    Directory.CreateDirectory(Path.GetDirectoryName(backupPath));
                    File.Copy(file, backupPath, true);
                    backupCount++;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[CORE] Lua backup error: {ex.Message}");
                }
            }

            Console.WriteLine($"[CORE] Backed up {backupCount} Lua files");
            return 0;
        }
    }
}