interface ErrorScreenProps {
    error: string;
}

export default function ErrorScreen({ error }: ErrorScreenProps) {
    const errorMessages = {
        'revoked': {
            title: 'Link Revoked',
            message: 'This photo has been revoked by the sender and is no longer available.',
            icon: '🔒',
        },
        'expired': {
            title: 'Link Expired',
            message: 'This photo link has expired and is no longer available.',
            icon: '⏰',
        },
        'not-found': {
            title: 'Photo Not Found',
            message: 'This link is invalid or the photo has been deleted.',
            icon: '❓',
        },
        'decryption-failed': {
            title: 'Decryption Failed',
            message: 'The photo could not be decrypted. The encryption key may be incorrect or the data corrupted.',
            icon: '🔑',
        },
    };

    const errorInfo = errorMessages[error as keyof typeof errorMessages] || errorMessages['not-found'];

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
                <div className="text-6xl mb-4">{errorInfo.icon}</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{errorInfo.title}</h1>
                <p className="text-gray-600 mb-6">{errorInfo.message}</p>
                <a
                    href="/"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                    Go Home
                </a>
            </div>
        </div>
    );
}
