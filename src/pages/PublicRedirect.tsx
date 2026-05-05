import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/utils';

export default function PublicRedirect() {
  const { qrId } = useParams<{ qrId: string }>();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!qrId) return;

    const fetchQR = async () => {
      try {
        const docRef = doc(db, 'qrTables', qrId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const target = data.dynamicLink;
          
          if (!target) {
            // Fallback to internal menu if no dynamic link is set
            navigate(`/menu/${data.restaurantId}/${data.tableNo || '0'}`, { replace: true });
          } else {
            // Redirect to external dynamic link
            window.location.href = target.startsWith('http') ? target : `https://${target}`;
          }
        } else {
          setError('Public Link not found.');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `qrTables/${qrId}`);
      }
    };

    fetchQR();
  }, [qrId, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-red-600">
          <h1 className="text-xl font-bold">Error</h1>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 font-bold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-white">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      <p className="mt-4 font-medium text-neutral-500">Redirecting to menu...</p>
    </div>
  );
}
