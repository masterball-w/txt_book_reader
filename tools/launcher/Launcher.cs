using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

internal static class Program
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);

    private const uint MB_OK = 0x00000000;
    private const uint MB_ICONERROR = 0x00000010;

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            if (string.IsNullOrEmpty(baseDir))
            {
                baseDir = Path.GetDirectoryName(Process.GetCurrentProcess().MainModule.FileName)
                          ?? Environment.CurrentDirectory;
            }
            baseDir = Path.GetFullPath(baseDir);

            string electronPath = Path.Combine(
                baseDir, "node_modules", "electron", "dist", "electron.exe");

            if (!File.Exists(electronPath))
            {
                ShowError(
                    "Electron not found:\n" + electronPath +
                    "\n\nRun npm install in the project root first.");
                return 1;
            }

            string mainJs = Path.Combine(baseDir, "main.js");
            if (!File.Exists(mainJs))
            {
                ShowError("main.js not found. Place ShuReader.exe in the project root.");
                return 1;
            }

            var argBuilder = new StringBuilder();
            argBuilder.Append('.');
            if (args != null && args.Length > 0)
            {
                foreach (string a in args)
                {
                    if (string.IsNullOrEmpty(a)) continue;
                    argBuilder.Append(' ');
                    argBuilder.Append(QuoteArg(a));
                }
            }

            var psi = new ProcessStartInfo
            {
                FileName = electronPath,
                Arguments = argBuilder.ToString(),
                WorkingDirectory = baseDir,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            if (psi.EnvironmentVariables.ContainsKey("ELECTRON_RUN_AS_NODE"))
            {
                psi.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
            }

            Process.Start(psi);
            return 0;
        }
        catch (Exception ex)
        {
            ShowError("Failed to start:\n" + ex.Message);
            return 1;
        }
    }

    private static string QuoteArg(string arg)
    {
        if (arg.IndexOfAny(new[] { ' ', '\t', '"' }) < 0)
        {
            return arg;
        }
        return "\"" + arg.Replace("\"", "\\\"") + "\"";
    }

    private static void ShowError(string message)
    {
        MessageBoxW(IntPtr.Zero, message, "ShuReader", MB_OK | MB_ICONERROR);
    }
}