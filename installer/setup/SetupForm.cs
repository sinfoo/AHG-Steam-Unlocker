using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AhgSetup
{
    // Frameless window hosting the AHG-styled HTML UI (installer/ui/index.html).
    // Flow: fetch latest GitHub release -> download .msi (sha256 verified) ->
    // msiexec per-user into the chosen folder -> drop shortcuts the user switched off.
    internal sealed class SetupForm : Form
    {
        private const string Repo = "sinfoo/AHG-Steam-Unlocker-Releases";
        private const string AppName = "AHG Unlocker";
        private const string ExeName = "AHG Unlocker.exe";
        private const long NeedBytes = 700L * 1024 * 1024; // msi download + unpacked app

        private readonly WebView2 _web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(8, 8, 15) };
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly CancellationTokenSource _cts = new CancellationTokenSource();
        private Release _release;
        private string _installedDir;
        private bool _busy;      // true while msiexec runs: closing then would leave a half install
        private bool _working;   // download/install in progress
        private bool _launched;  // the app was started by us (update mode relaunches it otherwise)

        private sealed class Release { public string Version, Url, Name, Digest; public long Size; }

        public SetupForm()
        {
            Text = AppName + " Setup";
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(8, 8, 15);
            // Size is set in DIPs below from the real monitor DPI. WinForms Dpi autoscaling on
            // .NET Framework never scaled this borderless window, so on 125-200% displays the
            // WebView content (which does scale) was cropped inside a 640x500-pixel window.
            AutoScaleMode = AutoScaleMode.None;
            Padding = new Padding(ResizeGrip); // keeps the window edges free for resize hit-testing
            Controls.Add(_web);
            Load += async (_, __) => await InitWeb();
            // Update mode: never leave the user without their app (failed install rolled back,
            // or the window was closed) — start whatever build is in the folder.
            FormClosed += (_, __) => { if (Program.UpdateDir != null && !_launched) { _installedDir = Program.UpdateDir; LaunchApp(); } };
        }

        private const int ResizeGrip = 6;
        private const int BaseW = 640, BaseH = 500, MinW = 480, MinH = 400;

        // Ask Windows for this monitor's real scale (the PerMonitorV2 manifest makes it accurate);
        // WinForms' own DeviceDpi needs an extra .config file, which a single-file setup can't ship.
        private int Dpi => GetDpiForWindow(Handle) is var d && d > 0 ? (int)d : 96;

        protected override void OnLoad(EventArgs e)
        {
            ApplyDpiSize(Dpi);
            base.OnLoad(e);
        }

        private void ApplyDpiSize(int dpi, Point? at = null)
        {
            var s = dpi / 96f;
            var area = Screen.FromHandle(Handle).WorkingArea;
            MinimumSize = new Size((int)(MinW * s), (int)(MinH * s));
            // never larger than the screen's usable area
            var w = Math.Min((int)(BaseW * s), area.Width - 40);
            var h = Math.Min((int)(BaseH * s), area.Height - 40);
            Size = new Size(w, h);
            Location = at ?? new Point(area.Left + (area.Width - w) / 2, area.Top + (area.Height - h) / 2);
        }

        // Borderless window: report edges/corners as resize areas so the user can drag-resize.
        protected override void WndProc(ref Message m)
        {
            const int WM_NCHITTEST = 0x84, WM_DPICHANGED = 0x02E0;
            if (m.Msg == WM_DPICHANGED) // dragged to a monitor with a different scale
            {
                var rc = (RECT)Marshal.PtrToStructure(m.LParam, typeof(RECT));
                ApplyDpiSize((int)((long)m.WParam & 0xFFFF), new Point(rc.Left, rc.Top));
                m.Result = IntPtr.Zero;
                return;
            }
            base.WndProc(ref m);
            if (m.Msg != WM_NCHITTEST || WindowState == FormWindowState.Maximized) return;
            var p = PointToClient(new Point(unchecked((short)(long)m.LParam), unchecked((short)((long)m.LParam >> 16))));
            int g = (int)(ResizeGrip * Dpi / 96f) + 2;
            bool l = p.X < g, r = p.X >= ClientSize.Width - g, t = p.Y < g, b = p.Y >= ClientSize.Height - g;
            if (t && l) m.Result = (IntPtr)13;      // HTTOPLEFT
            else if (t && r) m.Result = (IntPtr)14; // HTTOPRIGHT
            else if (b && l) m.Result = (IntPtr)16; // HTBOTTOMLEFT
            else if (b && r) m.Result = (IntPtr)17; // HTBOTTOMRIGHT
            else if (l) m.Result = (IntPtr)10;      // HTLEFT
            else if (r) m.Result = (IntPtr)11;      // HTRIGHT
            else if (t) m.Result = (IntPtr)12;      // HTTOP
            else if (b) m.Result = (IntPtr)15;      // HTBOTTOM
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            int round = 2, dark = 1; // Win11 rounded corners + dark frame; ignored on Win10
            DwmSetWindowAttribute(Handle, 33, ref round, 4);
            DwmSetWindowAttribute(Handle, 20, ref dark, 4);
        }

        protected override CreateParams CreateParams
        {
            get { var cp = base.CreateParams; cp.Style |= 0x00020000; /* WS_MINIMIZEBOX: taskbar minimize */ return cp; }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (_busy && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; return; }
            _cts.Cancel();
            base.OnFormClosing(e);
        }

        private async Task InitWeb()
        {
            try
            {
                CoreWebView2Environment.SetLoaderDllFolderPath(Program.Work);
                var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Program.Work, "wv2"));
                await _web.EnsureCoreWebView2Async(env);
            }
            catch (Exception ex)
            {
                // No WebView2 runtime (rare on Win10/11): offer the plain MSI instead of a dead window.
                if (MessageBox.Show("This setup needs the Microsoft Edge WebView2 Runtime.\n\n" + ex.Message +
                        "\n\nOpen the releases page to download the .msi installer instead?", Text,
                        MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes)
                    Process.Start("https://github.com/" + Repo + "/releases/latest");
                Close();
                return;
            }
            var core = _web.CoreWebView2;
            var s = core.Settings;
            s.AreDevToolsEnabled = false;
            s.AreDefaultContextMenusEnabled = false;
            s.IsStatusBarEnabled = false;
            s.IsZoomControlEnabled = false;
            s.AreBrowserAcceleratorKeysEnabled = false;
            core.SetVirtualHostNameToFolderMapping("setup.ahg", Path.Combine(Program.Work, "ui"), CoreWebView2HostResourceAccessKind.DenyCors);
            // UI is local only: block any navigation away from it
            core.NavigationStarting += (_, a) => { if (!a.Uri.StartsWith("https://setup.ahg/")) a.Cancel = true; };
            core.NewWindowRequested += (_, a) => a.Handled = true;
            core.WebMessageReceived += (_, a) => OnMessage(a.WebMessageAsJson);
            core.Navigate("https://setup.ahg/index.html");
        }

        private void Post(object msg)
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke(new Action(() => Post(msg))); return; }
            _web.CoreWebView2?.PostWebMessageAsJson(_json.Serialize(msg));
        }

        private async void OnMessage(string raw)
        {
            Dictionary<string, object> m;
            try { m = _json.Deserialize<Dictionary<string, object>>(raw); } catch { return; }
            string Str(string k) => m.TryGetValue(k, out var v) ? v as string : null;
            bool Flag(string k) => m.TryGetValue(k, out var v) && v is bool b && b;

            switch (Str("type"))
            {
                case "ready": await OnReady(); break;
                case "check": Post(DirInfo("dir", Str("dir"))); break;
                case "browse":
                    var picked = PickFolder(Str("dir"));
                    if (picked != null) Post(DirInfo("dir", picked));
                    break;
                case "install":
                    if (_working) return;
                    await Install(Str("dir"), Flag("desktop"), Flag("startMenu"), Flag("launch"));
                    break;
                case "launch": LaunchApp(); Close(); break;
                case "minimize": WindowState = FormWindowState.Minimized; break;
                case "close": Close(); break;
                case "drag": ReleaseCapture(); SendMessage(Handle, 0xA1 /* WM_NCLBUTTONDOWN */, (IntPtr)2 /* HTCAPTION */, IntPtr.Zero); break;
            }
        }

        // ── 1. release lookup ──
        private async Task OnReady()
        {
            var def = Program.UpdateDir ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", AppName);
            var init = DirInfo("init", def);
            try
            {
                _release = await FetchRelease();
                init["version"] = _release.Version;
            }
            catch (Exception ex)
            {
                Post(new Dictionary<string, object> { ["type"] = "error", ["stage"] = "download", ["message"] = "Could not reach GitHub: " + ex.Message });
                return;
            }
            Post(init);
            // Update: same folder, keep the shortcuts the user already has, relaunch when done.
            if (Program.UpdateDir != null)
                await Install(Program.UpdateDir, File.Exists(DesktopLnk), File.Exists(StartMenuLnk), true);
        }

        private static string DesktopLnk => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk");
        private static string StartMenuLnk => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppName + ".lnk");

        // The updater exits the app right after starting us; give it a moment, then end any
        // copy still running from the install folder so Windows Installer can replace its files.
        private static void WaitForAppExit(string dir)
        {
            var exe = Path.Combine(dir, ExeName);
            for (var i = 0; i < 40; i++)
            {
                var running = Process.GetProcessesByName(Path.GetFileNameWithoutExtension(ExeName)).Where(p =>
                {
                    try { return string.Equals(p.MainModule.FileName, exe, StringComparison.OrdinalIgnoreCase); }
                    catch { return false; }
                }).ToList();
                if (running.Count == 0) return;
                if (i == 39) foreach (var p in running) try { p.Kill(); p.WaitForExit(5000); } catch { }
                Thread.Sleep(500);
            }
        }

        private static HttpClient Http()
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            var h = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
            h.DefaultRequestHeaders.UserAgent.ParseAdd("AHG-Unlocker-Setup/1.0");
            return h;
        }

        private async Task<Release> FetchRelease()
        {
            // Test hook: install a locally built MSI instead of the GitHub release.
            var local = Environment.GetEnvironmentVariable("AHG_SETUP_MSI");
            if (!string.IsNullOrEmpty(local) && File.Exists(local))
                return new Release { Version = "local", Url = local, Name = Path.GetFileName(local), Size = new FileInfo(local).Length };

            using (var h = Http())
            using (var cts = CancellationTokenSource.CreateLinkedTokenSource(_cts.Token))
            {
                cts.CancelAfter(TimeSpan.FromSeconds(20));
                h.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
                var res = await h.GetAsync("https://api.github.com/repos/" + Repo + "/releases/latest", cts.Token);
                res.EnsureSuccessStatusCode();
                var rel = _json.Deserialize<Dictionary<string, object>>(await res.Content.ReadAsStringAsync());
                foreach (Dictionary<string, object> a in (System.Collections.ArrayList)rel["assets"])
                {
                    var name = a["name"] as string ?? "";
                    if (!name.EndsWith(".msi", StringComparison.OrdinalIgnoreCase)) continue;
                    var url = a["browser_download_url"] as string;
                    if (url == null || !url.StartsWith("https://github.com/" + Repo + "/")) continue; // only this repo
                    return new Release
                    {
                        Version = rel["tag_name"] as string,
                        Url = url,
                        Name = name,
                        Size = Convert.ToInt64(a["size"]),
                        Digest = a.TryGetValue("digest", out var d) ? d as string : null,
                    };
                }
                throw new Exception("the latest release has no .msi installer yet");
            }
        }

        // ── 2. folder validation / picker ──
        private static Dictionary<string, object> DirInfo(string type, string dir)
        {
            var r = new Dictionary<string, object> { ["type"] = type, ["dir"] = dir ?? "", ["need"] = NeedBytes, ["ok"] = false };
            try
            {
                if (string.IsNullOrWhiteSpace(dir) || !Path.IsPathRooted(dir) || dir.IndexOfAny(Path.GetInvalidPathChars()) >= 0)
                { r["reason"] = "Enter a full folder path, like C:\\Games\\AHG Unlocker."; return r; }
                var full = Path.GetFullPath(dir);
                var drive = new DriveInfo(Path.GetPathRoot(full));
                if (!drive.IsReady) { r["reason"] = "That drive isn't available."; return r; }
                r["free"] = drive.AvailableFreeSpace;
                if (drive.AvailableFreeSpace < NeedBytes) { r["reason"] = "Not enough free space on " + drive.Name; return r; }
                // probe the nearest existing ancestor for write access (Program Files needs admin)
                var probe = full;
                while (!Directory.Exists(probe)) probe = Path.GetDirectoryName(probe) ?? throw new IOException();
                var test = Path.Combine(probe, ".ahg-write-" + Guid.NewGuid().ToString("N"));
                File.WriteAllText(test, "");
                File.Delete(test);
                if (Directory.Exists(full) && File.Exists(Path.Combine(full, ExeName)) == false && Directory.GetFileSystemEntries(full).Length > 0)
                    r["warn"] = "Folder is not empty.";
                r["ok"] = true;
            }
            catch (UnauthorizedAccessException) { r["reason"] = "This folder needs admin rights. Pick one inside your user folder or another drive."; }
            catch (Exception) { r["reason"] = "This folder can't be used."; }
            return r;
        }

        private string PickFolder(string start)
        {
            var dlg = (IFileOpenDialog)new FileOpenDialogRCW();
            try
            {
                dlg.SetOptions(0x20 /* PICKFOLDERS */ | 0x40 /* FORCEFILESYSTEM */ | 0x800 /* PATHMUSTEXIST */);
                dlg.SetTitle("Choose where to install AHG Unlocker");
                var startDir = start;
                while (!string.IsNullOrEmpty(startDir) && !Directory.Exists(startDir)) startDir = Path.GetDirectoryName(startDir);
                if (!string.IsNullOrEmpty(startDir) && SHCreateItemFromParsingName(startDir, IntPtr.Zero, typeof(IShellItem).GUID, out var item) == 0)
                    dlg.SetFolder(item);
                if (dlg.Show(Handle) != 0) return null;
                dlg.GetResult(out var res);
                res.GetDisplayName(0x80058000 /* FILESYSPATH */, out var path);
                // installing straight into e.g. D:\Games would scatter files: nest in an app folder
                return path.TrimEnd('\\').EndsWith(AppName, StringComparison.OrdinalIgnoreCase) ? path : Path.Combine(path, AppName);
            }
            catch { return null; }
            finally { Marshal.ReleaseComObject(dlg); }
        }

        // ── 3. download -> verify -> msiexec -> shortcuts ──
        private async Task Install(string dir, bool desktop, bool startMenu, bool launch)
        {
            var check = DirInfo("dir", dir);
            if (!(bool)check["ok"]) { Post(check); return; }
            if (_release == null) return;
            _working = true;
            var stage = "download";
            try
            {
                dir = Path.GetFullPath(dir);
                var msi = Path.Combine(Program.Work, "AHG-Unlocker.msi");
                await Download(msi);

                stage = "verify";
                Progress(stage, "Checking sha256 against GitHub");
                if (_release.Digest != null)
                {
                    var expected = _release.Digest.StartsWith("sha256:") ? _release.Digest.Substring(7) : null;
                    var actual = await Task.Run(() => Sha256(msi));
                    if (expected != null && !string.Equals(expected, actual, StringComparison.OrdinalIgnoreCase))
                        throw new Exception("Download is corrupted (checksum mismatch). Please try again.");
                }

                stage = "install";
                Progress(stage, "Windows Installer is setting things up");
                _busy = true;
                var log = Path.Combine(Program.Work, "msi-install.log");
                var code = await Task.Run(() =>
                {
                    if (Program.UpdateDir != null) WaitForAppExit(dir);
                    // MSIFASTINSTALL=1: no System Restore point — it stalled installs for ~2 minutes.
                    var psi = new ProcessStartInfo("msiexec.exe",
                        $"/i \"{msi}\" /qn /norestart MSIFASTINSTALL=1 ALLUSERS=2 MSIINSTALLPERUSER=1 REINSTALLMODE=amus APPLICATIONFOLDER=\"{dir}\\\" /l*v \"{log}\"")
                    { UseShellExecute = false, CreateNoWindow = true };
                    using (var p = Process.Start(psi)) { p.WaitForExit(); return p.ExitCode; }
                });
                _busy = false;
                if (code != 0 && code != 3010) throw new Exception(MsiError(code));
                try { File.Delete(msi); } catch { }

                stage = "shortcuts";
                Progress(stage, "");
                // MSI always creates both shortcuts; remove the ones that were switched off
                if (!desktop) TryDelete(DesktopLnk);
                if (!startMenu) TryDelete(StartMenuLnk);
                await Task.Delay(400);

                _installedDir = dir;
                Post(new Dictionary<string, object> { ["type"] = "done", ["dir"] = dir });
                if (launch)
                {
                    await Task.Delay(1400); // let the success screen land
                    LaunchApp();
                    Close();
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                Post(new Dictionary<string, object> { ["type"] = "error", ["stage"] = stage, ["message"] = ex.Message });
            }
            finally { _busy = false; _working = false; }
        }

        private async Task Download(string dest)
        {
            var isLocal = !_release.Url.StartsWith("https://");
            using (var h = Http())
            using (var res = isLocal ? null : await h.GetAsync(_release.Url, HttpCompletionOption.ResponseHeadersRead, _cts.Token))
            {
                res?.EnsureSuccessStatusCode();
                var total = res?.Content.Headers.ContentLength ?? _release.Size;
                using (var src = isLocal ? File.OpenRead(_release.Url) : await res.Content.ReadAsStreamAsync())
                using (var dst = File.Create(dest))
                {
                    var buf = new byte[1 << 16];
                    long got = 0, lastBytes = 0;
                    var sw = Stopwatch.StartNew();
                    long lastTick = 0;
                    double speed = 0;
                    int n;
                    while ((n = await src.ReadAsync(buf, 0, buf.Length, _cts.Token)) > 0)
                    {
                        await dst.WriteAsync(buf, 0, n, _cts.Token);
                        got += n;
                        var now = sw.ElapsedMilliseconds;
                        if (now - lastTick >= 120)
                        {
                            var inst = (got - lastBytes) * 1000.0 / Math.Max(1, now - lastTick);
                            speed = speed == 0 ? inst : speed * 0.7 + inst * 0.3; // smoothed
                            lastTick = now; lastBytes = got;
                            Post(new Dictionary<string, object> { ["type"] = "progress", ["stage"] = "download", ["received"] = got, ["total"] = total, ["speed"] = (long)speed });
                        }
                    }
                    Post(new Dictionary<string, object> { ["type"] = "progress", ["stage"] = "download", ["received"] = got, ["total"] = total, ["speed"] = (long)speed });
                    if (total > 0 && got != total) throw new Exception("Download was interrupted. Please try again.");
                }
            }
        }

        private void Progress(string stage, string detail) =>
            Post(new Dictionary<string, object> { ["type"] = "progress", ["stage"] = stage, ["detail"] = detail });

        private static string Sha256(string file)
        {
            using (var sha = SHA256.Create())
            using (var f = File.OpenRead(file))
                return BitConverter.ToString(sha.ComputeHash(f)).Replace("-", "").ToLowerInvariant();
        }

        private static string MsiError(int code)
        {
            switch (code)
            {
                case 1602: return "Installation was cancelled.";
                case 1618: return "Another installation is running. Wait for it to finish and try again.";
                case 1638: return "A different version of AHG Unlocker is already installed. Uninstall it from Settings > Apps, then try again.";
                case 1925: case 1303: case 1310: return "Windows refused to write to that folder. Pick another location.";
                default: return "Windows Installer failed (code " + code + "). Details: " + Path.Combine(Program.Work, "msi-install.log");
            }
        }

        private void LaunchApp()
        {
            var exe = _installedDir == null ? null : Path.Combine(_installedDir, ExeName);
            if (exe == null || !File.Exists(exe)) return;
            _launched = true;
            Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WorkingDirectory = _installedDir });
        }

        private static void TryDelete(string f) { try { if (File.Exists(f)) File.Delete(f); } catch { } }

        // ── Win32 ──
        [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }
        [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr hwnd);
        [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr h, int attr, ref int val, int size);
        [DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr h, int msg, IntPtr w, IntPtr l);
        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
        private static extern int SHCreateItemFromParsingName(string path, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, out IShellItem item);

        [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] private class FileOpenDialogRCW { }

        [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IFileOpenDialog
        {
            [PreserveSig] int Show(IntPtr parent);
            void SetFileTypes(); void SetFileTypeIndex(); void GetFileTypeIndex(); void Advise(); void Unadvise();
            void SetOptions(uint fos); void GetOptions();
            void SetDefaultFolder(IShellItem si); void SetFolder(IShellItem si);
            void GetFolder(); void GetCurrentSelection(); void SetFileName(); void GetFileName();
            void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
            void SetOkButtonLabel(); void SetFileNameLabel();
            void GetResult(out IShellItem si);
        }

        [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IShellItem
        {
            void BindToHandler(); void GetParent();
            void GetDisplayName(uint sigdn, [MarshalAs(UnmanagedType.LPWStr)] out string name);
        }
    }
}
