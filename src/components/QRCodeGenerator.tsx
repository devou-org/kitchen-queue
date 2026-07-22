import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Copy, RefreshCw, QrCode } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface QRCodeGeneratorProps {
  url: string;
  title: string;
  description?: string;
  primaryColor?: string;
}

export function QRCodeGenerator({ 
  url, 
  title, 
  description, 
  primaryColor = '#0f172a' 
}: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generateKey, setGenerateKey] = useState(0); // Used to force re-render if needed
  const [lastGenerated, setLastGenerated] = useState<Date>(new Date());

  // const handleRegenerate = () => {
  //   setGenerateKey(prev => prev + 1);
  //   setLastGenerated(new Date());
  //   toast.success('QR Code regenerated successfully');
  // };

  const handleDownload = () => {
    const canvas = document.getElementById(`qr-canvas-${title.replace(/\s+/g, '-')}`) as HTMLCanvasElement;
    if (!canvas) {
      toast.error('Failed to find QR code for download');
      return;
    }
    
    // Create an image data URL from the canvas
    const imageUrl = canvas.toDataURL('image/png');
    
    // Create a temporary link element to trigger the download
    const downloadLink = document.createElement('a');
    downloadLink.href = imageUrl;
    downloadLink.download = `${title.toLowerCase().replace(/\s+/g, '-')}-qrcode.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    toast.success('QR Code downloaded successfully');
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('URL copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy URL');
    }
  };

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <QrCode size={18} />
        {title}
      </h2>
      {description && <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: '16px' }}>{description}</p>}
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        
        {/* Render a high-resolution canvas but scale it down with CSS for display */}
        <div style={{ padding: '16px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '16px' }}>
          <QRCodeCanvas 
            key={generateKey}
            id={`qr-canvas-${title.replace(/\s+/g, '-')}`}
            value={url}
            size={1024} // High resolution for download
            level="H" // High error correction
            fgColor={primaryColor}
            style={{ width: '200px', height: '200px' }} // Display size
          />
        </div>

        <div style={{ width: '100%', marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
            Destination URL
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              readOnly 
              value={url} 
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontSize: '13px', backgroundColor: 'white' }} 
            />
            <button 
              type="button"
              onClick={handleCopyUrl}
              title="Copy URL"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '8px' }}>
          {/* <div style={{ fontSize: '11px', color: '#64748b' }}>
            <span style={{ fontWeight: 600 }}>Last generated:</span><br/>
            {lastGenerated.toLocaleString()}
          </div> */}
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* <button 
              type="button"
              onClick={handleRegenerate}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <RefreshCw size={14} />
              Regenerate
            </button> */}
            <button 
              type="button"
              onClick={handleDownload}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: primaryColor, border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            >
              <Download size={14} />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
