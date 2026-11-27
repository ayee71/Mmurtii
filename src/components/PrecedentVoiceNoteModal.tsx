import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Copy,
  Check,
  X,
  Clock,
  Sparkles,
  Volume2,
  AlertCircle,
  FileText,
  Bookmark,
  Send,
  Radio,
} from 'lucide-react';
import { Language } from '../i18n/translations';
import { CassationPrecedent } from '../data/cassationPrecedents';
import {
  PrecedentPersonalNote,
  getPrecedentPersonalNotes,
  savePrecedentPersonalNote,
  deletePrecedentPersonalNote,
} from '../services/precedentNoteService';
import { formatSpokenLegalText } from '../hooks/useLegalDictation';
import { useAuth } from '../context/AuthContext';

interface PrecedentVoiceNoteModalProps {
  precedent: CassationPrecedent;
  currentLang: Language;
  isOpen: boolean;
  onClose: () => void;
  onNoteSaved?: (note: PrecedentPersonalNote) => void;
}

export const PrecedentVoiceNoteModal: React.FC<PrecedentVoiceNoteModalProps> = ({
  precedent,
  currentLang,
  isOpen,
  onClose,
  onNoteSaved,
}) => {
  const { user, profile } = useAuth();
  const authorName =
    profile?.visitorName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Abbaa Seeraa / Ogeessa';

  const [selectedLanguage, setSelectedLanguage] = useState<'om' | 'am' | 'en'>(
    (currentLang as 'om' | 'am' | 'en') || 'om'
  );
  const [selectedDialect, setSelectedDialect] = useState<string>(
    currentLang === 'am' ? 'am-ET' : currentLang === 'en' ? 'en-US' : 'om-ET'
  );

  // Recording & dictation state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [dictatedText, setDictatedText] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [selectedTag, setSelectedTag] = useState<'general' | 'issue' | 'ratio' | 'strategy' | 'citation'>('general');
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Playback state
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  // Notes list state
  const [savedNotes, setSavedNotes] = useState<PrecedentPersonalNote[]>([]);

  // Refs for SpeechRecognition & MediaRecorder
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const accumulatedFinalRef = useRef<string>('');

  const isSpeechSupported =
    typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Load notes on open or precedent change
  useEffect(() => {
    if (precedent?.id) {
      setSavedNotes(getPrecedentPersonalNotes(precedent.id));
    }
  }, [precedent?.id, isOpen]);

  // Clean up recording on unmount or close
  useEffect(() => {
    return () => {
      cleanupRecording();
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
      }
    };
  }, []);

  const cleanupRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
  };

  const getDialectCode = (lang: 'om' | 'am' | 'en') => {
    if (lang === 'am') return 'am-ET';
    if (lang === 'en') return 'en-US';
    return 'om-ET';
  };

  const handleLanguageChange = (lang: 'om' | 'am' | 'en') => {
    setSelectedLanguage(lang);
    setSelectedDialect(getDialectCode(lang));
  };

  // Start Voice Dictation using SpeechRecognition API
  const startRecording = async () => {
    setRecordError(null);
    accumulatedFinalRef.current = dictatedText;
    audioChunksRef.current = [];
    setRecordedAudioUrl(null);

    // 1. Initialize SpeechRecognition API
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = selectedDialect;

        recognition.onresult = (event: any) => {
          let interim = '';
          let finalPiece = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalPiece += transcript + ' ';
            } else {
              interim += transcript;
            }
          }

          if (finalPiece) {
            const formatted = formatSpokenLegalText(
              finalPiece,
              selectedLanguage,
              true
            );
            accumulatedFinalRef.current += (accumulatedFinalRef.current ? ' ' : '') + formatted;
            setDictatedText(accumulatedFinalRef.current);
          }

          setInterimText(interim);
        };

        recognition.onerror = (e: any) => {
          console.warn('[PrecedentVoiceNote] SpeechRecognition error:', e?.error);
          if (e?.error === 'not-allowed') {
            setRecordError('Microphone permission was denied. Please allow microphone access.');
          }
        };

        recognition.onend = () => {
          if (isRecording) {
            // Keep continuous alive if still recording
            try {
              recognition.start();
            } catch {}
          }
        };

        recognition.start();
      } catch (err: any) {
        console.warn('[PrecedentVoiceNote] SpeechRecognition start failed:', err);
      }
    }

    // 2. Initialize MediaRecorder for audio playback if audio capture is supported
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                setRecordedAudioUrl(reader.result);
              }
            };
            reader.readAsDataURL(blob);
          }
        };

        recorder.start(500);
      }
    } catch (micErr: any) {
      console.warn('[PrecedentVoiceNote] MediaRecorder optional capture notice:', micErr?.message);
    }

    // 3. Start timer
    setIsRecording(true);
    setRecordingSeconds(0);
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Stop Voice Dictation
  const stopRecording = () => {
    setIsRecording(false);
    setInterimText('');
    cleanupRecording();
  };

  // Format seconds as MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // Save the personal note
  const handleSaveNote = () => {
    if (!dictatedText.trim()) {
      setRecordError('Maaloo barruu yaadaa galchaa ykn sagaleedhaan dubbadhaa.');
      return;
    }

    const title =
      noteTitle.trim() ||
      `Yaada Galmee ${precedent.fileNumber} (${new Date().toLocaleDateString()})`;

    try {
      const saved = savePrecedentPersonalNote({
        precedentId: precedent.id,
        fileNumber: precedent.fileNumber,
        title,
        content: dictatedText.trim(),
        audioDataUrl: recordedAudioUrl || undefined,
        durationSeconds: recordingSeconds > 0 ? recordingSeconds : undefined,
        language: selectedLanguage,
        tag: selectedTag,
        authorName,
      });

      setSavedNotes(getPrecedentPersonalNotes(precedent.id));
      setDictatedText('');
      setNoteTitle('');
      setRecordedAudioUrl(null);
      setRecordingSeconds(0);
      setRecordError(null);
      setToastMessage('Yaadni sagalee milkaa\'inaan kuufameera! ✓');
      setTimeout(() => setToastMessage(null), 3000);

      if (onNoteSaved) {
        onNoteSaved(saved);
      }
    } catch (err: any) {
      setRecordError(err?.message || 'Yaada olkaahuun hin milkoofne.');
    }
  };

  // Delete an existing personal note
  const handleDeleteNote = (noteId: string) => {
    deletePrecedentPersonalNote(precedent.id, noteId);
    setSavedNotes(getPrecedentPersonalNotes(precedent.id));
    if (playingNoteId === noteId && playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      setPlayingNoteId(null);
    }
  };

  // Copy note text
  const handleCopyNote = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  // Play audio note
  const togglePlayNote = (note: PrecedentPersonalNote) => {
    if (!note.audioDataUrl) return;

    if (playingNoteId === note.id) {
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
      }
      setPlayingNoteId(null);
      return;
    }

    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
    }

    const audio = new Audio(note.audioDataUrl);
    playbackAudioRef.current = audio;
    audio.onended = () => setPlayingNoteId(null);
    audio.onerror = () => setPlayingNoteId(null);
    audio.play();
    setPlayingNoteId(note.id);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Precedent Personal Voice Notes"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900 border border-amber-500/40 shadow-2xl p-5 sm:p-6 space-y-5 text-slate-100 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            cleanupRecording();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 font-serif-legal">
                Yaada Sagaleetiin Galmeessi (Voice Notes)
              </h3>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold font-mono">
                Galmee {precedent.fileNumber}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Browser SpeechRecognition fayyadamuun yaada dhuunfaa murtii kana irratti sagaleedhaan barreessi.
            </p>
          </div>
        </div>

        {/* Ruling Quick Preview */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <span>Vol. {precedent.volume}</span>
            <span>•</span>
            <span>{precedent.courtJurisdiction === 'oromia' ? 'Oromiyaa Cassation' : 'Federal Cassation'}</span>
            <span>•</span>
            <span>Bara {precedent.yearEC} B.A.</span>
          </div>
          <div className="font-bold text-slate-200 line-clamp-1">
            {precedent.parties[currentLang] || precedent.parties.om}
          </div>
          <p className="text-[11px] text-slate-400 line-clamp-2">
            {precedent.bindingPrinciple[currentLang] || precedent.bindingPrinciple.om}
          </p>
        </div>

        {/* SpeechRecognition Status Banner */}
        {!isSpeechSupported && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">SpeechRecognition API Notice:</span> Browser-riin kun Web Speech API kallattiin hin deeggaru (fkn Chrome/Edge/Safari filatamaadha). Ta'us barruu harkaan galchuu dandeessu.
            </div>
          </div>
        )}

        {/* Language & Dialect Selector Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Afaan Dubbii (Language):</span>
            <div className="flex items-center gap-1.5">
              {(['om', 'am', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleLanguageChange(lang)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedLanguage === lang
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {lang === 'om' ? 'Afaan Oromoo' : lang === 'am' ? 'አማርኛ' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Category Tag:</span>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value as any)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-amber-400"
            >
              <option value="general">Yaada Waliigalaa (General)</option>
              <option value="issue">Dhimma Ijoo (Legal Issue)</option>
              <option value="ratio">Qajeeltoo Dirqisiisaa (Ratio)</option>
              <option value="strategy">Mala Falmii (Strategy)</option>
              <option value="citation">Waraabbii Labsii (Citation)</option>
            </select>
          </div>
        </div>

        {/* Voice Dictation Control Area */}
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer transition-all ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4 fill-white" />
                    <span>Dhaabi (Stop Dictation)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Sagaleen Dubbadhu (Start Dictation)</span>
                  </>
                )}
              </button>

              {isRecording && (
                <div className="flex items-center gap-2 font-mono text-xs text-red-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span>{formatTime(recordingSeconds)}</span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
              <Radio className={`w-3.5 h-3.5 ${isRecording ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
              <span>{isRecording ? 'Listening live via SpeechRecognition...' : 'SpeechRecognition Ready'}</span>
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Mata Duree Yaadaa (Optional Title):
            </label>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder={`Fkn: Qabxii Kwt. ${precedent.statutoryProvisions[0] || '12'} irratti xiyyeeffatu`}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Dictated / Transcribed Text Box */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <label className="font-bold uppercase tracking-wider">Barruu Yaadaa (Dictated Notes):</label>
              <span>{dictatedText.length} characters</span>
            </div>
            <div className="relative">
              <textarea
                value={dictatedText}
                onChange={(e) => {
                  setDictatedText(e.target.value);
                  accumulatedFinalRef.current = e.target.value;
                }}
                rows={4}
                placeholder="Sagaleedhaan dubbadhaa ykn asirratti harkaan barreessaa... (Web Speech API speech-to-text live streaming)"
                className="w-full p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-100 leading-relaxed placeholder-slate-600 focus:outline-none focus:border-amber-400 font-sans"
              />
              {interimText && (
                <div className="mt-1 px-2 text-[11px] text-amber-300 italic flex items-center gap-1.5 animate-pulse">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Streaming: "{interimText}"</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Save Note & Clear */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              {recordedAudioUrl && (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 flex items-center gap-1 font-mono">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Audio Captured ({formatTime(recordingSeconds)})</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDictatedText('');
                  accumulatedFinalRef.current = '';
                  setInterimText('');
                  setRecordedAudioUrl(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-slate-800 cursor-pointer transition-colors"
              >
                Qulqulleessi (Clear)
              </button>

              <button
                type="button"
                onClick={handleSaveNote}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Yaada Olkaayi (Save Note)</span>
              </button>
            </div>
          </div>

          {recordError && (
            <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded-xl px-3 py-2">
              {recordError}
            </p>
          )}

          {toastMessage && (
            <p className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-3 py-2">
              {toastMessage}
            </p>
          )}
        </div>

        {/* Existing Personal Notes on this Precedent */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Yaadawwan Kanaan Dura Kuufaman ({savedNotes.length})</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Personal Archive</span>
          </div>

          {savedNotes.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
              Murtii kana irratti yaadni dhuunfaa ammaaf hin jiru. Sagaleedhaan dubbachuun olkaayadhaa.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {savedNotes.map((note) => {
                const isPlaying = playingNoteId === note.id;
                return (
                  <div
                    key={note.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-amber-300">{note.title}</span>
                        {note.tag && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400 uppercase font-mono">
                            {note.tag}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(note.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {note.audioDataUrl && (
                          <button
                            type="button"
                            onClick={() => togglePlayNote(note)}
                            className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 cursor-pointer transition-colors"
                            title={isPlaying ? 'Pause' : 'Play audio note'}
                          >
                            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopyNote(note.content, note.id)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer transition-colors"
                          title="Copy text"
                        >
                          {copiedId === note.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 cursor-pointer transition-colors"
                          title="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrecedentVoiceNoteModal;
