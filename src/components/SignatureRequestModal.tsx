import React, { useState } from 'react';
import { SignaturePad } from './SignaturePad';
import { addSignatureToSharedDraft, SharedDraft } from '../services/sharedDraftService';
import { auth } from '../services/firebase';

interface SignatureRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: SharedDraft;
  onSuccess: (updatedDraft: SharedDraft) => void;
}

export const SignatureRequestModal: React.FC<SignatureRequestModalProps> = ({ isOpen, onClose, draft, onSuccess }) => {
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signerName, setSignerName] = useState<string>(
    () => auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || ''
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveSignature = async (data: string) => {
    const cleanName = signerName.trim();
    if (!cleanName) {
      setErrorMsg('Maaloo maqaa mallatteessaa guutaa / Please enter signer name.');
      return;
    }
    setErrorMsg(null);
    const currentUser = auth.currentUser;
    const signature = {
      userId: currentUser?.uid || `guest_${Date.now()}`,
      name: cleanName,
      signatureData: data,
      signedAt: new Date().toISOString(),
    };
    const success = await addSignatureToSharedDraft(draft.shareToken, signature);
    if (success) {
      onSuccess({ ...draft, signatures: [...(draft.signatures || []), signature] });
      onClose();
    } else {
      setErrorMsg('Mallattoo galmeessuun hin milkoofne / Failed to save signature.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-lg font-bold text-white">Sign Document</h3>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Maqaa Mallatteessaa / Signer Full Name
          </label>
          <input
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Full Name..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          />
        </div>
        {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
        <SignaturePad onSave={handleSaveSignature} onClear={() => setSignatureData(null)} />
        <button onClick={onClose} className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-bold">Cancel</button>
      </div>
    </div>
  );
};
