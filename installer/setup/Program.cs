using System;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

namespace AhgSetup
{
    internal static class Program
    {
        // Scratch dir for the WebView2 loader, UI files, browser profile and the downloaded MSI.
        internal static readonly string Work = Path.Combine(Path.GetTempPath(), "ahg-setup");

        [STAThread]
        private static void Main()
        {
            // Must be wired before any WebView2 type is touched (JIT resolves them in Run()).
            AppDomain.CurrentDomain.AssemblyResolve += (_, e) =>
            {
                var name = new AssemblyName(e.Name).Name;
                using (var s = Res("lib/" + name + ".dll"))
                {
                    if (s == null) return null;
                    var buf = new byte[s.Length];
                    s.Read(buf, 0, buf.Length);
                    return Assembly.Load(buf);
                }
            };
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Run();
        }

        private static void Run()
        {
            Directory.CreateDirectory(Path.Combine(Work, "ui"));
            Extract("native/WebView2Loader.dll", Path.Combine(Work, "WebView2Loader.dll"));
            foreach (var f in new[] { "index.html", "logo.png", "geist.woff2" })
                Extract("ui/" + f, Path.Combine(Work, "ui", f));
            Application.Run(new SetupForm());
        }

        internal static Stream Res(string name) => typeof(Program).Assembly.GetManifestResourceStream(name);

        private static void Extract(string res, string dest)
        {
            using (var s = Res(res))
            using (var f = File.Create(dest))
                s.CopyTo(f);
        }
    }
}
