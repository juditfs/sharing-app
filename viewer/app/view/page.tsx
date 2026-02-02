import { Suspense } from 'react';
import { Metadata } from 'next';
import ViewPage from './ViewPage';
import LoadingState from '@/components/LoadingState';

// Force dynamic rendering so OG tags are generated per request
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: 'Sharene',
        description: 'Encrypted photo sharing'
    };
}

export default function View() {
    return (
        <Suspense fallback={<LoadingState />}>
            <ViewPage />
        </Suspense>
    );
}
