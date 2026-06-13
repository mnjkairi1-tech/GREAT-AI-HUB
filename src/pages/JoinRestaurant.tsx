import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { onAuthStateChanged } from 'firebase/auth';
import SleekLoader from '../components/SleekLoader';

export default function JoinRestaurant() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [restaurantName, setRestaurantName] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
            navigate('/');
            return;
        }
        if (!restaurantId) {
            navigate('/');
            return;
        }

        try {
            const docSnap = await getDoc(doc(db, 'restaurants', restaurantId));
            if (docSnap.exists()) {
                setRestaurantName(docSnap.data().name);
            } else {
                alert("Restaurant not found");
                navigate('/');
            }
        } catch(e) {
            handleFirestoreError(e, OperationType.GET, 'restaurants');
        }
        setLoading(false);
    });
    return unsubAuth;
  }, [restaurantId, navigate]);

  const handleJoin = async () => {
    if (!auth.currentUser?.email) return;
    try {
        await addDoc(collection(db, 'inviteRequests'), {
            restaurantId: restaurantId,
            email: auth.currentUser.email,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        setRequestSent(true);
    } catch(e) {
        handleFirestoreError(e, OperationType.WRITE, 'inviteRequests');
    }
  };

  if (loading) return <SleekLoader message="Retrieving invitation profile" />;

  return (
    <div className="flex h-screen items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm">
            <h1 className="text-2xl font-bold mb-4">Join {restaurantName}</h1>
            {requestSent ? (
                <p className="text-green-600 font-bold">Access request sent! Please wait for approval.</p>
            ) : (
                <button 
                  onClick={handleJoin}
                  className="w-full bg-orange-600 text-white font-bold p-4 rounded-xl"
                >
                    Request Access as Staff
                </button>
            )}
        </div>
    </div>
  );
}
