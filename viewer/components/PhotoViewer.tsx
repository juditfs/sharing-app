'use client';

interface PhotoViewerProps {
    photoUrl: string;
    shareText: string;
}

export default function PhotoViewer({ photoUrl, shareText }: PhotoViewerProps) {
    return (
        <div className="fixed inset-0 flex flex-col bg-gray-900">
            {/* Photo Container - takes up remaining space */}
            <div className="flex-1 relative overflow-hidden">
                <img
                    src={photoUrl}
                    alt={shareText}
                    className="absolute inset-0 w-full h-full object-contain"
                />
            </div>

            {/* Info Bar - fixed at bottom */}
            <div className="bg-white p-4 border-t border-gray-200">
                <p className="text-gray-700 text-center text-sm">{shareText}</p>
            </div>
        </div>
    );
}
