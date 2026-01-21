'use client';

interface PhotoViewerProps {
    photoUrl: string;
    shareText: string;
    allowDownload: boolean;
}

export default function PhotoViewer({ photoUrl, shareText, allowDownload }: PhotoViewerProps) {
    const handleDownload = () => {
        const a = document.createElement('a');
        a.href = photoUrl;
        a.download = 'sharene-photo.jpg';
        a.click();
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900">
            <div className="max-w-4xl w-full bg-white rounded-lg shadow-xl overflow-hidden">
                {/* Photo */}
                <div className="relative">
                    <img
                        src={photoUrl}
                        alt={shareText}
                        className="w-full h-auto"
                    />
                </div>

                {/* Info Bar */}
                <div className="p-6 border-t border-gray-200">
                    <p className="text-gray-700 text-center mb-4">{shareText}</p>

                    {allowDownload && (
                        <button
                            onClick={handleDownload}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                        >
                            Download Photo
                        </button>
                    )}

                    {!allowDownload && (
                        <p className="text-sm text-gray-500 text-center">
                            Download disabled by sender
                        </p>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
                <p className="text-gray-400 text-sm">
                    Shared securely with <span className="font-semibold">Sharene</span>
                </p>
            </div>
        </div>
    );
}
