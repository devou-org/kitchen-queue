$printerName = "POS-80C"

# ESC/POS commands
$bytes = [System.Collections.Generic.List[byte]]::new()

# Initialize
$bytes.AddRange([byte[]](0x1B, 0x40))

# Center
$bytes.AddRange([byte[]](0x1B, 0x61, 0x01))

# Bold ON
$bytes.AddRange([byte[]](0x1B, 0x45, 0x01))

# Text
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("QDINE`n"))

# Bold OFF
$bytes.AddRange([byte[]](0x1B, 0x45, 0x00))

# Left
$bytes.AddRange([byte[]](0x1B, 0x61, 0x00))

# Test receipt
$text = @"
------------------------------
TEST PRINT
------------------------------
Chicken Burger       x2
French Fries         x1
Cold Coffee          x1
------------------------------
Counter: Counter 1
------------------------------

"@

$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes($text))

# Feed 3 lines
$bytes.AddRange([byte[]](0x1B, 0x64, 0x03))

# Cut paper
$bytes.AddRange([byte[]](0x1D, 0x56, 0x00))

# Create RAW print job using Win32 API
Add-Type @"
using System;
using System.Runtime.InteropServices;

public class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFO
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(
        string pPrinterName,
        out IntPtr phPrinter,
        IntPtr pDefault
    );

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int StartDocPrinter(
        IntPtr hPrinter,
        int level,
        DOCINFO di
    );

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(
        IntPtr hPrinter,
        byte[] pBytes,
        int dwCount,
        out int dwWritten
    );

    public static bool SendBytes(string printerName, byte[] bytes)
    {
        IntPtr hPrinter;

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            return false;

        DOCINFO di = new DOCINFO();
        di.pDocName = "Qdine Test";
        di.pDataType = "RAW";

        int job = StartDocPrinter(hPrinter, 1, di);

        if (job == 0)
        {
            ClosePrinter(hPrinter);
            return false;
        }

        StartPagePrinter(hPrinter);

        int written;
        bool result = WritePrinter(
            hPrinter,
            bytes,
            bytes.Length,
            out written
        );

        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);

        return result;
    }
}
"@

$result = [RawPrinter]::SendBytes(
    $printerName,
    $bytes.ToArray()
)

if ($result) {
    Write-Host "SUCCESS: Print job sent to $printerName"
}
else {
    Write-Host "ERROR: Failed to send print job"
}