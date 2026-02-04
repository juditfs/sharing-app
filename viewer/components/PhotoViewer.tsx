'use client';

interface PhotoViewerProps {
    photoUrl: string;
    shareText: string;
    allowDownload: boolean;
}

export default function PhotoViewer({ photoUrl, shareText, allowDownload }: PhotoViewerProps) {
    const handleContextMenu = (e: React.MouseEvent) => {
        if (!allowDownload) {
            e.preventDefault();
        }
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-gray-900">
            {/* Photo Container - takes up remaining space */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                {allowDownload ? (
                    <img
                        src={photoUrl}
                        alt={shareText}
                        className="max-w-full max-h-full object-contain"
                    />
                ) : (
                    <div
                        className="w-full h-full bg-contain bg-center bg-no-repeat"
                        style={{
                            backgroundImage: `url(${photoUrl})`,
                            WebkitTouchCallout: 'none',
                        }}
                        onContextMenu={handleContextMenu}
                        style={{ WebkitTouchCallout: 'none' }}
                    />
                )}
            </div>

            {/* Info Bar - fixed at bottom */}
            <div className="bg-white p-4 border-t border-gray-200 z-10">
                <p className="text-gray-700 text-center text-sm">{shareText}</p>
            </div>
        </div>
    );
}
