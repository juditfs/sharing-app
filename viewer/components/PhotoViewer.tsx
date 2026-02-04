'use client';

interface PhotoViewerProps {
    photoUrl: string;
    shareText: string;
    allowDownload: boolean;
}

export default function PhotoViewer({ photoUrl, shareText, allowDownload }: PhotoViewerProps) {
    // Debug logging
    console.log('🔒 PhotoViewer allowDownload:', allowDownload);

    const handleBlockInteraction = (e: React.MouseEvent | React.TouchEvent | React.DragEvent) => {
        console.log('🚫 Interaction blocked!', e.type);
        if (!allowDownload) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <div
            className="fixed inset-0 flex flex-col bg-gray-900"
            style={!allowDownload ? { userSelect: 'none', WebkitUserSelect: 'none' } : {}}
        >
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
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                        }}
                    />
                )}

                {/* Transparent interaction blocker overlay */}
                {!allowDownload && (
                    <div
                        className="absolute inset-0 z-50 bg-transparent"
                        style={{
                            WebkitTouchCallout: 'none',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            touchAction: 'none',
                        }}
                        onContextMenu={handleBlockInteraction}
                        onTouchStart={handleBlockInteraction}
                        onTouchEnd={handleBlockInteraction}
                        onTouchMove={handleBlockInteraction}
                        onMouseDown={handleBlockInteraction}
                        onMouseUp={handleBlockInteraction}
                        onDragStart={handleBlockInteraction}
                        onDrop={handleBlockInteraction}
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
