import { Suspense } from 'react';
import ViewPage from './ViewPage';
import LoadingState from '@/components/LoadingState';

export default function View() {
    return (
        <Suspense fallback={<LoadingState />}>
            <ViewPage />
        </Suspense>
    );
}
