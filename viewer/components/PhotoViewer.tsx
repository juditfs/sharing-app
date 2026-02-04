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
                <img
                    src={photoUrl}
                    alt={shareText}
                    className={`max-w-full max-h-full object-contain ${!allowDownload ? 'pointer-events-none select-none' : ''
                        }`}
                    onContextMenu={handleContextMenu}
                    style={!allowDownload ? { WebkitTouchCallout: 'none' } : {}}
                />
                {!allowDownload && (
                    // Transparent overlay to capture long-press on mobile while allowing pinch-zoom (mostly)
                    // Actually, pointer-events-none on img usually prevents context menu on mobile,
                    // but we might need this overlay to catch the event if pointer-events passes it through.
                    // A simple overlay that blocks all interaction might be annoying for zoom.
                    // Let's rely on pointer-events-none + onContextMenu + WebkitTouchCallout.
                    // Duplicate handler on parent wrapper just in case.
                    <div
                        className="absolute inset-0"
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
