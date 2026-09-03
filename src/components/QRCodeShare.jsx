import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import styled from 'styled-components';
import { FiDownload } from 'react-icons/fi';

const QRContainer = styled.div`
  background: #111b21;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  margin: 20px auto;
  text-align: center;
`;

const QRTitle = styled.h3`
  color: #e9edef;
  margin-bottom: 12px;
  font-size: 1.1rem;
  font-weight: 600;
`;

const QRDescription = styled.p`
  color: #8696a0;
  margin-bottom: 20px;
  font-size: 0.9rem;
`;

const QRCodeWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  padding: 15px;
  background: #f9fafb;
  border-radius: 6px;
  position: relative;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
`;

const LogoOverlay = styled.img`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  padding: 4px;
  border-radius: 8px;
  z-index: 10;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
`;

const DownloadButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #00a884;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: background-color 0.2s ease;

  &:hover {
    background: #008c71;
  }

  &:active {
    transform: scale(0.98);
  }
`;

const ShareText = styled.p`
  color: #6b7280;
  font-size: 0.85rem;
  margin-top: 15px;
`;

const URLDisplay = styled.div`
  background: #202c33;
  border: 1px solid #2a3942;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 15px;
  word-break: break-all;
  font-size: 0.8rem;
  color: #00a884;
`;

export const QRCodeShare = ({ 
  url = 'https://somalux.co.ke',
  title = 'Scan to Visit Somalux',
  description = 'Scan the QR code with your phone to visit our platform'
}) => {
  const [downloadStatus, setDownloadStatus] = useState('');
  const canvasRef = useRef();

  const handleDownload = (format = 'png') => {
    if (!canvasRef.current) return;

    try {
      const qrCanvas = canvasRef.current.querySelector('canvas');
      if (!qrCanvas) {
        setDownloadStatus('Error: Could not generate QR code');
        setTimeout(() => setDownloadStatus(''), 2000);
        return;
      }

      // Create a new canvas with logo
      const canvas = document.createElement('canvas');
      canvas.width = qrCanvas.width;
      canvas.height = qrCanvas.height;
      const ctx = canvas.getContext('2d');

      // Draw QR code
      ctx.drawImage(qrCanvas, 0, 0);

      // Load and draw logo
      const logoImg = new Image();
      logoImg.onload = () => {
        const logoSize = 80;
        const x = (canvas.width - logoSize) / 2;
        const y = (canvas.height - logoSize) / 2;
        ctx.drawImage(logoImg, x, y, logoSize, logoSize);

        // Download
        const link = document.createElement('a');
        link.download = `somalux-qrcode.${format}`;
        link.href = canvas.toDataURL(`image/${format}`);
        link.click();

        setDownloadStatus(`Downloaded as ${format.toUpperCase()}!`);
        setTimeout(() => setDownloadStatus(''), 2000);
      };
      logoImg.src = '/somalux-logo.svg';
    } catch (error) {
      console.error('Download error:', error);
      setDownloadStatus('Error downloading QR code');
      setTimeout(() => setDownloadStatus(''), 2000);
    }
  };

  return (
    <QRContainer>
      <QRTitle>{title}</QRTitle>
      <QRDescription>{description}</QRDescription>

      <URLDisplay>
        URL: {url}
      </URLDisplay>

      <QRCodeWrapper ref={canvasRef}>
        <QRCodeCanvas
          value={url}
          size={300}
          level="H"
          includeMargin={true}
          quietZone={10}
        />
        <LogoOverlay src="/somalux-logo.svg" alt="SomaLux Logo" />
      </QRCodeWrapper>

      <ButtonGroup>
        <DownloadButton onClick={() => handleDownload('png')}>
          <FiDownload size={18} />
          PNG
        </DownloadButton>
        <DownloadButton onClick={() => handleDownload('jpg')}>
          <FiDownload size={18} />
          JPG
        </DownloadButton>
      </ButtonGroup>

      {downloadStatus && (
        <ShareText style={{ color: downloadStatus.includes('Error') ? '#ef4444' : '#10b981' }}>
          {downloadStatus}
        </ShareText>
      )}
    </QRContainer>
  );
};

export default QRCodeShare;
