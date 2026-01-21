export default function LoadingState() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-white text-lg">Decrypting photo...</p>
            </div>
        </div>
    );
}
