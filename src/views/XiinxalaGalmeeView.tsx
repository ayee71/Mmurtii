import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderPlus,
  Loader2,
  Printer,
  RotateCcw,
  Scale,
  Sparkles,
  Square,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { Language } from '../i18n/translations';
import { VoiceRecordButton } from '../components/VoiceRecordButton';
import { extractDocumentPreservingLanguage } from '../services/documentExtractionService';
import {
  streamLegalAnalysis,
  StreamLegalSource,
  StreamPhase,
  sanitizeStreamTextPreservingWhitespace,
} from '../services/legalStreamClient';
import { runSeeraAIWorkflow, SeeraAIWorkflowClientResult } from '../services/seeraAiWorkflowClient';
import { getStoredAiOutputLanguage } from '../services/storage';
import { saveDocument } from '../services/storage';
import { getStoredOfflineMode } from '../services/syncUtils';

interface XiinxalaGalmeeViewProps {
  currentLang: Language;
  onNavigateTab?: (tab: string) => void;
}

type AIEngineChoice = 'gemini-4-hydrogen' | 'deep_thinking' | 'dual-ai' | 'offline-template';
type CaseTypeKey = 'civil' | 'land' | 'family' | 'criminal' | 'procedure' | 'labor' | 'commercial';

interface DraftState {
  aiEngine: AIEngineChoice;
  caseType: CaseTypeKey;
  aanaaCaseText: string;
  olaaCaseText: string;
  ragaaText: string;
  falmiiText: string;
  yaadaText: string;
}

const DRAFT_STORAGE_KEY = 'seera_xiinxala_galmee_draft_v1';

const CASE_TYPES: {
  value: CaseTypeKey;
  labelOm: string;
  labelAm: string;
  labelEn: string;
  statutoryRef: string;
}[] = [
  {
    value: 'civil',
    labelOm: 'Seera Hariiroo Siivilii (Civil Code)',
    labelAm: 'የፍትሐብሔር ሕግ (Civil Code)',
    labelEn: 'Civil Code (Seera Hariiroo Siivilii)',
    statutoryRef: 'Heera Hariiroo Hawaasaa Itoophiyaa (1960 Civil Code)',
  },
  {
    value: 'land',
    labelOm: 'Seera Lafa Baadiyyaa (Rural Land Law)',
    labelAm: 'የገጠር መሬት አስተዳደር ሕግ',
    labelEn: 'Rural Land Administration & Use Law',
    statutoryRef: 'Labsii Bulchiinsaa fi Itti Fayyadama Lafa Baadiyyaa Oromiyaa Lakk. 130/1999 & Fed. Proc. 456/2005',
  },
  {
    value: 'family',
    labelOm: 'Seera Maatii (Family Law)',
    labelAm: 'የቤተሰብ ሕግ (Family Code)',
    labelEn: 'Revised Family Code',
    statutoryRef: 'Seera Maatii Oromiyaa (Labsii Lakk. 69/1995 & 83/1996) / Revised Federal Family Code Proc. 213/2000',
  },
  {
    value: 'criminal',
    labelOm: 'Seera Yakkaa (Criminal Code)',
    labelAm: 'የወንጀል ሕግ (Criminal Code)',
    labelEn: 'FDRE Criminal Code (Proc. 414/2004)',
    statutoryRef: 'Seera Yakkaa RDFI (Labsii Lakk. 414/2004)',
  },
  {
    value: 'procedure',
    labelOm: 'Seera Adeemsa Falmii Siivilii (SDFHH)',
    labelAm: 'የፍትሐብሔር ሥነ-ሥርዓት ሕግ',
    labelEn: 'Civil Procedure Code (SDFHH)',
    statutoryRef: 'Seera Adeemsa Falmii Hariiroo Hawaasaa (1965 Civil Procedure Code)',
  },
  {
    value: 'labor',
    labelOm: 'Seera Hojjetaa fi Hojjechiisaa (Labor Law)',
    labelAm: 'የአሠሪና ሠራተኛ ሕግ',
    labelEn: 'Labor Proclamation No. 1156/2019',
    statutoryRef: 'Labsii Hojjetaa fi Hojjechiisaa Lakk. 1156/2019',
  },
  {
    value: 'commercial',
    labelOm: 'Seera Daldalaa (Commercial Code)',
    labelAm: 'የንግድ ሕግ (Commercial Code)',
    labelEn: 'New Commercial Code (Proc. 1243/2021)',
    statutoryRef: 'Seera Daldalaa Haaraa RDFI (Labsii Lakk. 1243/2021)',
  },
];

function buildLocalStructuredReport(params: {
  aiLabel: string;
  caseTypeLabel: string;
  aanaa: string;
  olaanaa: string;
  ragaa: string;
  falmii: string;
  yaada: string;
}): string {
  const { aiLabel, caseTypeLabel, aanaa, olaanaa, ragaa, falmii, yaada } = params;
  return (
    `XIINXALA GALMEE\n` +
    `================\n\n` +
    `AI Filatame: ${aiLabel}\n\n` +
    `AKAAKUU DHIMMAA:\n${caseTypeLabel}\n\n` +
    `1. DHUFAATII DHIMMICHAA\n` +
    `Galmeen mana murtii aanaa fi galmeen mana murtii olaanaa wal bira qabamee qoratameera.\n\n` +
    `2. MURTII MANA MURTII AANAA\n` +
    `${aanaa ? aanaa.substring(0, 1200) + (aanaa.length > 1200 ? ' ...' : '') : 'Hin kennamne.'}\n\n` +
    `3. MURTII MANA MURTII OLAANAA\n` +
    `${olaanaa ? olaanaa.substring(0, 1200) + (olaanaa.length > 1200 ? ' ...' : '') : 'Hin kennamne.'}\n\n` +
    `4. MADAALLII RAGAA\n` +
    `${ragaa || 'Ragaan galmee keessatti dhiyaate irratti xiinxalli taasifameera.'}\n\n` +
    `5. TUMAALEE SEERAA\n` +
    `Madda seeraa filatame: ${caseTypeLabel}\n\n` +
    `6. ADEEMSA FALMII\n` +
    `${falmii || 'Himannaa, Deebii, Ragaa, Murtii walitti qabamee qoratameera.'}\n\n` +
    `7. YAADA FI BU'AA\n` +
    `${yaada || 'Murtiin mana murtiiwwan lamaanii wal bira qabamee madaalameera.'}\n\n` +
    `8. GOOLABA\n` +
    `Bu'aan xiinxalaa kun qorannoo dursaa irratti hundaa'eedha.\n\n` +
    `Akeekkachiisa: Kun hubannoo seeraatiif kan qophaa'e qofa; gorsa ogeessa seeraa (abukaatoo) bakka hin bu'u.`
  );
}

export const XiinxalaGalmeeView: React.FC<XiinxalaGalmeeViewProps> = ({
  currentLang,
  onNavigateTab,
}) => {
  const [aiEngine, setAiEngine] = useState<AIEngineChoice>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<DraftState>;
        if (parsed.aiEngine) return parsed.aiEngine;
      }
    } catch {
      // ignore storage error
    }
    return 'gemini-4-hydrogen';
  });

  const [caseType, setCaseType] = useState<CaseTypeKey>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<DraftState>;
        if (parsed.caseType) return parsed.caseType;
      }
    } catch {
      // ignore
    }
    return 'civil';
  });

  const [aanaaCaseText, setAanaaCaseText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      return saved ? JSON.parse(saved).aanaaCaseText || '' : '';
    } catch {
      return '';
    }
  });
  const [olaaCaseText, setOlaaCaseText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      return saved ? JSON.parse(saved).olaaCaseText || '' : '';
    } catch {
      return '';
    }
  });
  const [ragaaText, setRagaaText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      return saved ? JSON.parse(saved).ragaaText || '' : '';
    } catch {
      return '';
    }
  });
  const [falmiiText, setFalmiiText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      return saved ? JSON.parse(saved).falmiiText || '' : '';
    } catch {
      return '';
    }
  });
  const [yaadaText, setYaadaText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      return saved ? JSON.parse(saved).yaadaText || '' : '';
    } catch {
      return '';
    }
  });

  const [reportText, setReportText] = useState<string>('');
  const [dualResult, setDualResult] = useState<SeeraAIWorkflowClientResult | null>(null);
  const [dualTab, setDualTab] = useState<'synthesis' | 'gemini' | 'openai'>('synthesis');
  const [sources, setSources] = useState<StreamLegalSource[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [phaseLabel, setPhaseLabel] = useState<string>('');
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedDocTitle, setSavedDocTitle] = useState<string | null>(null);
  const [extractingTarget, setExtractingTarget] = useState<'aanaa' | 'olaanaa' | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  // Persist user draft safely in localStorage
  useEffect(() => {
    try {
      const draft: DraftState = {
        aiEngine,
        caseType,
        aanaaCaseText,
        olaaCaseText,
        ragaaText,
        falmiiText,
        yaadaText,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore quota errors
    }
  }, [aiEngine, caseType, aanaaCaseText, olaaCaseText, ragaaText, falmiiText, yaadaText]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const selectedCaseMeta = useMemo(
    () => CASE_TYPES.find((c) => c.value === caseType) || CASE_TYPES[0],
    [caseType]
  );

  const getCaseLabel = (c: (typeof CASE_TYPES)[number]) =>
    currentLang === 'am' ? c.labelAm : currentLang === 'en' ? c.labelEn : c.labelOm;

  const activeEngineLabel = useMemo(() => {
    switch (aiEngine) {
      case 'gemini-4-hydrogen':
        return 'Gemini 4 Hydrogen (Streaming & Grounded)';
      case 'deep_thinking':
        return 'Gemini Deep Thinking';
      case 'dual-ai':
        return 'Dual AI (Gemini + ChatGPT GPT-4o)';
      case 'offline-template':
        return 'Offline 8-Part Structurer';
    }
  }, [aiEngine]);

  const displayedReport = useMemo(() => {
    if (aiEngine === 'dual-ai' && dualResult) {
      if (dualTab === 'gemini') return dualResult.geminiResponse || reportText;
      if (dualTab === 'openai') return dualResult.openaiResponse || reportText;
      return dualResult.synthesis || reportText;
    }
    return reportText;
  }, [aiEngine, dualResult, dualTab, reportText]);

  const wordCount = useMemo(() => {
    const trimmed = displayedReport.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [displayedReport]);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'aanaa' | 'olaanaa'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    setExtractingTarget(target);
    try {
      const extracted = await extractDocumentPreservingLanguage(file, 'auto');
      const text = (extracted.text || '').trim();
      if (!text) {
        setErrorMessage(
          currentLang === 'om'
            ? `Faayila "${file.name}" keessaa barreeffamni argamuu hin dandeenye. Maaloo barreeffama kallattiin maxxansi.`
            : `Could not extract text from "${file.name}". Please paste the ruling text directly.`
        );
        return;
      }

      if (target === 'aanaa') {
        setAanaaCaseText((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
      } else {
        setOlaaCaseText((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
      }
      setStatusMessage(
        currentLang === 'om'
          ? `Faayilli "${file.name}" dubbifamee galmaa'eera.`
          : `"${file.name}" extracted successfully.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Faayila dubbisuun hin milkoofne.');
    } finally {
      setExtractingTarget(null);
    }
  };

  const handleLoadSample = () => {
    setCaseType('land');
    setAanaaCaseText(
      'Galmee Lakk. 14289 - Mana Murtii Aanaa Adaamaa: Himataan abbaa qabiyyee lafa baadiyyaa heektaara 1.5 ta’uu waraqaa ragaa qabiyyee lakk. OR/1998/441 dhiyeeffateera. Haa ta’u malee, manni murtii aanaa ragaa namaa himatamaa qofa irratti hundaa’uun himannaa kufaa godheera.'
    );
    setOlaaCaseText(
      'Galmee Ol-iyyannoo Lakk. 28710 - Mana Murtii Olaanaa Godina Shawaa Bahaa: Manni murtii olaanaa murtii mana murtii aanaa cimsuun ragaa barreeffamaa (waraqaa qabiyyee lafaa) osoo hin madaalin ol-iyyannoo kuffiseera.'
    );
    setRagaaText(
      '1) Waraqaa Ragaa Qabiyyee Lafa Baadiyyaa Lakk. OR/1998/441\n2) Nagahee gibira lafaa waggaa 5 (2011–2015)\n3) Ragaa namoota 3 (ragaa barreeffamaa waliin kan wal faallessu)'
    );
    setFalmiiText(
      'Himannaa: Falmii mirga qabiyyee lafa baadiyyaa.\nDeebii: Himatamaan qabiyyee maatii dhaalaan argadhe jedhe, garuu waraqaa ragaa hin dhiyeessine.\nMurtii Aanaa & Olaanaa: Himannaa fi ol-iyyannoon kufaa ta’eera.'
    );
    setYaadaText(
      'Manni murtii aanaas ta’e olaanaan madaallii ragaa barreeffamaa (Labsii Lafa Baadiyyaa Oromiyaa 130/1999 & SDFHH kwt 254) sirnaan hin gaggeessine; dhaddacha ijibbaataatti dhiyaachuu qaba.'
    );
    setErrorMessage(null);
    setStatusMessage(
      currentLang === 'om'
        ? 'Fakkeenyi galmee fe’ameera. Amma "Xiinxala uumi" cuqaasi.'
        : 'Sample case loaded. Click "Xiinxala uumi" to generate the analysis.'
    );
  };

  const handleReset = () => {
    abortControllerRef.current?.abort();
    setAanaaCaseText('');
    setOlaaCaseText('');
    setRagaaText('');
    setFalmiiText('');
    setYaadaText('');
    setReportText('');
    setDualResult(null);
    setSources([]);
    setStatusMessage('');
    setErrorMessage(null);
    setSavedDocTitle(null);
    setElapsedMs(0);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsAnalyzing(false);
    setPhaseLabel('');
    setStatusMessage(
      currentLang === 'om' ? 'Xiinxalli addaan citeera.' : 'Analysis stopped.'
    );
  };

  const handleGenerateAnalysis = async () => {
    const aanaa = aanaaCaseText.trim();
    const olaanaa = olaaCaseText.trim();
    const ragaa = ragaaText.trim();
    const falmii = falmiiText.trim();
    const yaada = yaadaText.trim();

    if (!aanaa && !olaanaa) {
      setErrorMessage(null);
      setStatusMessage('Dura murtii aanaa yookaan olaanaa maxxansi.');
      return;
    }

    setErrorMessage(null);
    setSavedDocTitle(null);
    setDualResult(null);
    setSources([]);
    setReportText('');

    const caseLabel = getCaseLabel(selectedCaseMeta);
    const offlineLocalReport = buildLocalStructuredReport({
      aiLabel: activeEngineLabel,
      caseTypeLabel: caseLabel,
      aanaa,
      olaanaa,
      ragaa,
      falmii,
      yaada,
    });

    const isOffline =
      getStoredOfflineMode() || (typeof navigator !== 'undefined' && navigator.onLine === false);

    if (aiEngine === 'offline-template' || isOffline) {
      setReportText(offlineLocalReport);
      setStatusMessage(
        isOffline && aiEngine !== 'offline-template'
          ? 'Haala Offline keessa jirta — gabaasni caasaa 8 qabu qophaa’eera.'
          : 'Xiinxalli qophaa’eera. Amma download gochuu dandeessa.'
      );
      return;
    }

    setIsAnalyzing(true);
    setPhaseLabel(
      currentLang === 'om'
        ? 'Madda seeraa fi murtiiwwan ijibbaataa wal bira qabaa jira...'
        : 'Grounding against statutes and Cassation precedents...'
    );
    setStatusMessage('');
    setElapsedMs(0);
    const startTime = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 250);

    const structuredPrompt = `Ati SEERAAI PRO dha. Galmee mana murtii armaan gadii (Murtii Mana Murtii Aanaa fi Murtii Mana Murtii Olaanaa) gadi fageenyaan wal bira qabii xiinxali.
Madda Seeraa Filatame: ${caseLabel} (${selectedCaseMeta.statutoryRef}).
Afaan Deebii: ${currentLang === 'am' ? 'አማርኛ (Amharic)' : currentLang === 'en' ? 'English' : 'Afaan Oromoo'} (qabiyyee seeraa sirrii fi madda seeraa wajjin).

Deebii kee caasaa mata-duree 8 armaan gadii kana sirritti hordofee qopheessi:
XIINXALA GALMEE
================
1. DHUFAATII DHIMMICHAA
2. MURTII MANA MURTII AANAA (jabina fi hanqina seeraa/adeemsaa)
3. MURTII MANA MURTII OLAANAA (sababa cimsuu ykn diiguu fi dogoggora seeraa bu'uuraa yoo jiraate)
4. MADAALLII RAGAA (ragaa barreeffamaa vs ragaa namaa, ulfaatina ragaa)
5. TUMAALEE SEERAA FI MURTII DHADDACHA IJIBBAATAA (keewwata sirrii, lakkoofsa labsii, fi galmee ijibbaataa rogummaa qabu)
6. ADEEMSA FALMII (SDFHH / SFY — himannaa, deebii, dhaggeeffannaa, ol-iyyannoo/ijibbaataa)
7. YAADA FI BU'AA (xiinxala murtii lamaanii fi furmaata qabatamaa)
8. GOOLABA (fi Akeekkachiisa seeraa)

ODE EFFANNOO GALMEE:
- MURTII MANA MURTII AANAA:
${aanaa || 'Hin kennamne.'}

- MURTII MANA MURTII OLAANAA:
${olaanaa || 'Hin kennamne.'}

- RAGAA GALMEE:
${ragaa || 'Hin ibsamne.'}

- ADEEMSA FALMII:
${falmii || 'Hin ibsamne.'}

- YAADA FI GOOLABA FAYYADAMAA:
${yaada || 'Hin ibsamne.'}`;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const activeOutputLang = getStoredAiOutputLanguage();
      if (aiEngine === 'dual-ai') {
        setPhaseLabel(
          currentLang === 'om'
            ? 'Gemini + ChatGPT (GPT-4o) wal bira qabanii xiinxalaa jiru...'
            : 'Running Dual AI (Gemini + ChatGPT GPT-4o) case synthesis...'
        );
        const result = await runSeeraAIWorkflow({
          prompt: structuredPrompt,
          context: `Case Type: ${caseLabel}\nAanaa: ${aanaa}\nOlaanaa: ${olaanaa}`,
          mode: 'dual',
          outputLanguage: activeOutputLang,
          saveToFirebase: false,
        });
        setDualResult(result);
        setDualTab('synthesis');
        setReportText(result.synthesis || result.geminiResponse || result.openaiResponse || offlineLocalReport);
        setStatusMessage('Xiinxalli Dual AI qophaa’eera. Amma download gochuu dandeessa.');
      } else {
        const result = await streamLegalAnalysis(
          {
            prompt: structuredPrompt,
            context: `XIINXALA GALMEE — ${caseLabel}`,
            language: activeOutputLang,
            outputLanguage: activeOutputLang,
            outputLanguages: [activeOutputLang],
            responseFormat: 'direct_full',
            modelTier: aiEngine === 'deep_thinking' ? 'deep_thinking' : 'gemini-4-hydrogen',
            isThinkingMode: aiEngine === 'deep_thinking',
            researchMode: aiEngine === 'deep_thinking' ? 'deep' : 'fast',
            jurisdiction: caseType === 'land' ? 'oromia' : 'both',
          },
          {
            onPhase: (_phase: StreamPhase, label: string) => {
              if (label) setPhaseLabel(label);
            },
            onSources: (incoming) => {
              setSources(incoming);
            },
            onChunk: (_delta, accumulated) => {
              setReportText(sanitizeStreamTextPreservingWhitespace(accumulated));
            },
            onDone: (donePayload) => {
              const cleaned = sanitizeStreamTextPreservingWhitespace(donePayload.fullText || '');
              if (cleaned) setReportText(cleaned);
              setStatusMessage('Xiinxalli qophaa’eera. Amma download gochuu dandeessa.');
            },
            onError: (err) => {
              setErrorMessage(err.message);
            },
          },
          controller.signal
        );

        if (!result && !controller.signal.aborted) {
          setReportText((prev) => prev || offlineLocalReport);
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setErrorMessage(
          err?.message ||
            'Tajaajilli AI yeroof hin deebisne; caasaan 8 qopheessaa offline irraa hojjetameera.'
        );
        setReportText((prev) => prev || offlineLocalReport);
        setStatusMessage('Caasaa 8 bu’uuraa qophaa’eera.');
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedMs(Date.now() - startTime);
      setIsAnalyzing(false);
      setPhaseLabel('');
    }
  };

  const handleDownloadReport = () => {
    const text = displayedReport.trim();
    if (!text) {
      setStatusMessage('Dura "Xiinxala uumi" cuqaasi.');
      return;
    }
    // BOM: Afaan Oromoo fi qubee addaa sirriitti akka mul'atuuf
    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Xiinxala_Galmee.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatusMessage('Xiinxala_Galmee.txt gadi buufameera.');
  };

  const handleCopyReport = async () => {
    const text = displayedReport.trim();
    if (!text) {
      setStatusMessage('Dura "Xiinxala uumi" cuqaasi.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setStatusMessage('Koppii godhameera.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatusMessage('Koppii hin milkoofne. Barreeffama filadhuu koppii godhi.');
    }
  };

  const handleSaveToLibrary = () => {
    const text = displayedReport.trim();
    if (!text) {
      setStatusMessage('Dura "Xiinxala uumi" cuqaasi.');
      return;
    }
    const title = `Xiinxala Galmee — ${getCaseLabel(selectedCaseMeta)}`;
    saveDocument({
      title,
      taskType: 'explain_law',
      prompt: `Aanaa: ${aanaaCaseText.slice(0, 120)} | Olaanaa: ${olaaCaseText.slice(0, 120)}`,
      outputLanguages: [currentLang],
      content: text,
      tags: ['Xiinxala Galmee', selectedCaseMeta.value, aiEngine],
    });
    setSavedDocTitle(title);
    setStatusMessage(
      currentLang === 'om'
        ? 'Gabaasni gara "Sanadoota Kiyya" (My Content) keessatti olkaa’ameera.'
        : 'Report saved to My Saved Documents.'
    );
  };

  const handlePrint = () => {
    if (!displayedReport.trim()) {
      setStatusMessage('Dura "Xiinxala uumi" cuqaasi.');
      return;
    }
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 pb-24">
      {/* Header Bar */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Scale className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-serif-legal">
              {currentLang === 'am'
                ? 'የመዝገብ ንጽጽር ትንተና (Xiinxala Galmee)'
                : currentLang === 'en'
                ? 'Xiinxala Galmee — Lower vs High Court Case Analysis'
                : 'Xiinxala Galmee'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {currentLang === 'am'
                ? 'የወረዳና የከፍተኛ ፍርድ ቤት ውሳኔዎችን ያስገቡ፣ ሕጋዊ ትንተና ይፍጠሩ እና ሪፖርቱን (.txt) ያውርዱ።'
                : currentLang === 'en'
                ? 'Paste or upload Woreda and High Court rulings to generate a structured 8-section analysis and download a UTF-8 .txt report.'
                : 'Murtii mana murtii aanaa fi olaanaa maxxansiitii, xiinxala uumiitii, report .txt gadi buusi.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadSample}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {currentLang === 'om' ? 'Fakkeenya Galmee' : 'Load Sample'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{currentLang === 'om' ? 'Haqi' : 'Clear'}</span>
          </button>
        </div>
      </header>

      {/* Main Two-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Case Content & Evidence Form */}
        <div className="lg:col-span-6 space-y-5">
          {/* Section 1: Qabiyyee Murtii */}
          <section
            aria-labelledby="qabiyyee-heading"
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 id="qabiyyee-heading" className="text-base font-bold text-white">
                Qabiyyee Murtii
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {selectedCaseMeta.value.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="xiinxala-ai-model"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  AI filatame
                </label>
                <select
                  id="xiinxala-ai-model"
                  value={aiEngine}
                  onChange={(e) => setAiEngine(e.target.value as AIEngineChoice)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Streaming &amp; RAG)</option>
                  <option value="deep_thinking">Gemini Deep Thinking (Gadi Fagoo)</option>
                  <option value="dual-ai">Dual AI (Gemini + ChatGPT GPT-4o)</option>
                  <option value="offline-template">Offline / Quick 8-Part Template</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="xiinxala-case-type"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Madda Seeraa (akaakuu dhimmaa)
                </label>
                <select
                  id="xiinxala-case-type"
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value as CaseTypeKey)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  {CASE_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {getCaseLabel(ct)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Murtii Mana Murtii Aanaa */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="aanaaCaseText"
                  className="text-xs font-medium text-slate-300"
                >
                  Murtii Mana Murtii Aanaa
                </label>
                <div className="flex items-center gap-2">
                  <label className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-400 text-[11px] font-medium cursor-pointer flex items-center gap-1 transition-colors">
                    {extractingTarget === 'aanaa' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    <span>{currentLang === 'om' ? 'Faayila Fe’i' : 'Upload'}</span>
                    <input
                      type="file"
                      accept=".txt,.pdf,.docx,.doc,image/*"
                      onChange={(e) => handleFileUpload(e, 'aanaa')}
                      className="hidden"
                    />
                  </label>
                  <VoiceRecordButton
                    size="sm"
                    mode="icon-only"
                    currentLang={currentLang}
                    currentValue={aanaaCaseText}
                    onValueChange={setAanaaCaseText}
                  />
                </div>
              </div>
              <textarea
                id="aanaaCaseText"
                rows={4}
                value={aanaaCaseText}
                onChange={(e) => setAanaaCaseText(e.target.value)}
                placeholder="Murtii guutuu as maxxansi"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 leading-relaxed"
              />
            </div>

            {/* Murtii Mana Murtii Olaanaa */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="olaaCaseText"
                  className="text-xs font-medium text-slate-300"
                >
                  Murtii Mana Murtii Olaanaa
                </label>
                <div className="flex items-center gap-2">
                  <label className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-400 text-[11px] font-medium cursor-pointer flex items-center gap-1 transition-colors">
                    {extractingTarget === 'olaanaa' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    <span>{currentLang === 'om' ? 'Faayila Fe’i' : 'Upload'}</span>
                    <input
                      type="file"
                      accept=".txt,.pdf,.docx,.doc,image/*"
                      onChange={(e) => handleFileUpload(e, 'olaanaa')}
                      className="hidden"
                    />
                  </label>
                  <VoiceRecordButton
                    size="sm"
                    mode="icon-only"
                    currentLang={currentLang}
                    currentValue={olaaCaseText}
                    onValueChange={setOlaaCaseText}
                  />
                </div>
              </div>
              <textarea
                id="olaaCaseText"
                rows={4}
                value={olaaCaseText}
                onChange={(e) => setOlaaCaseText(e.target.value)}
                placeholder="Murtii guutuu as maxxansi"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 leading-relaxed"
              />
            </div>
          </section>

          {/* Section 2: Madaallii Ragaa fi Adeemsa Falmii */}
          <section
            aria-labelledby="ragaa-heading"
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h2 id="ragaa-heading" className="text-base font-bold text-white border-b border-slate-800 pb-3">
              Madaallii Ragaa fi Adeemsa Falmii
            </h2>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="ragaaText" className="text-xs font-medium text-slate-300">
                  Ragaa (dirqama)
                </label>
                <VoiceRecordButton
                  size="sm"
                  mode="icon-only"
                  currentLang={currentLang}
                  currentValue={ragaaText}
                  onValueChange={setRagaaText}
                />
              </div>
              <textarea
                id="ragaaText"
                rows={3}
                value={ragaaText}
                onChange={(e) => setRagaaText(e.target.value)}
                placeholder="Ragaa galmee keessa jiru"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="falmiiText" className="text-xs font-medium text-slate-300">
                  Adeemsa falmii (himannaa, deebii, ragaa, murtii)
                </label>
                <VoiceRecordButton
                  size="sm"
                  mode="icon-only"
                  currentLang={currentLang}
                  currentValue={falmiiText}
                  onValueChange={setFalmiiText}
                />
              </div>
              <textarea
                id="falmiiText"
                rows={3}
                value={falmiiText}
                onChange={(e) => setFalmiiText(e.target.value)}
                placeholder="Adeemsa falmii gabaabsii"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="yaadaText" className="text-xs font-medium text-slate-300">
                  Yaada fi goolaba kee
                </label>
                <VoiceRecordButton
                  size="sm"
                  mode="icon-only"
                  currentLang={currentLang}
                  currentValue={yaadaText}
                  onValueChange={setYaadaText}
                />
              </div>
              <textarea
                id="yaadaText"
                rows={3}
                value={yaadaText}
                onChange={(e) => setYaadaText(e.target.value)}
                placeholder="Yaada ofii kee"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 leading-relaxed"
              />
            </div>

            {/* Section 3: Primary CTA */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateAnalysis}
                disabled={isAnalyzing}
                className="flex-1 min-w-[200px] py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{isAnalyzing ? 'Xiinxalaa Jira...' : 'Xiinxala uumi'}</span>
              </button>

              {isAnalyzing && (
                <button
                  type="button"
                  onClick={handleStop}
                  className="py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-rose-500/40 text-rose-300 font-semibold text-xs flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <Square className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{currentLang === 'om' ? 'Dhaabi' : 'Stop'}</span>
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Analysis Output, Grounded Sources & Export Actions */}
        <div className="lg:col-span-6 space-y-5 lg:sticky lg:top-20">
          <section
            aria-labelledby="buaa-heading"
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 id="buaa-heading" className="text-base font-bold text-white">
                  Bu&apos;aa Xiinxalaa
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                  {activeEngineLabel} · {wordCount} words
                  {elapsedMs > 0 ? ` · ${(elapsedMs / 1000).toFixed(1)}s` : ''}
                </p>
              </div>

              {aiEngine === 'dual-ai' && dualResult && (
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['synthesis', 'gemini', 'openai'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDualTab(tab)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        dualTab === tab
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab === 'synthesis'
                        ? 'Synthesis'
                        : tab === 'gemini'
                        ? 'Gemini'
                        : 'GPT-4o'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="px-3.5 py-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            {isAnalyzing && phaseLabel && (
              <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
                <span>{phaseLabel}</span>
              </div>
            )}

            {/* Report Display */}
            <div
              ref={outputRef}
              aria-live="polite"
              className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[340px] max-h-[560px] overflow-y-auto text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-sans"
            >
              {displayedReport ? (
                displayedReport
              ) : (
                <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center text-slate-500 px-4">
                  <FileText className="w-8 h-8 mb-2 opacity-40 text-amber-400" aria-hidden="true" />
                  <p>Xiinxalli asitti mul&apos;ata.</p>
                </div>
              )}
            </div>

            {/* Export & Save Controls */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadReport}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Download Report (.txt)</span>
              </button>

              <button
                type="button"
                onClick={handleCopyReport}
                className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Koppii godhi</span>
              </button>

              <button
                type="button"
                onClick={handleSaveToLibrary}
                className="px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>{currentLang === 'om' ? 'Olkaa’i' : 'Save'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 print:hidden"
              >
                <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{currentLang === 'om' ? 'Maxxansi' : 'Print'}</span>
              </button>
            </div>

            {/* Live Status Line */}
            {statusMessage && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-300 pt-1">
                <span>{statusMessage}</span>
                {savedDocTitle && onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('myContent')}
                    className="text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer"
                  >
                    {currentLang === 'om' ? 'Sanadoota Kiyya Ilaali →' : 'Open My Saved Docs →'}
                  </button>
                )}
              </div>
            )}

            {/* Grounded Sources from Backend Stream */}
            {sources.length > 0 && (
              <div className="border-t border-slate-800 pt-3.5 space-y-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {currentLang === 'om'
                    ? `Madda Seeraa & Dhaddacha Ijibbaataa (${sources.length})`
                    : `Grounded Legal Authorities (${sources.length})`}
                </h3>
                <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {sources.map((src) => (
                    <li
                      key={src.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-amber-300">{src.title}</span>
                        {src.telegramPostUrl && (
                          <a
                            href={src.telegramPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 shrink-0 font-mono text-[11px]"
                          >
                            <span>Telegram</span>
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {[
                          src.fileNumber ? `Galmee ${src.fileNumber}` : '',
                          src.proclamationNumber ? `Labsii ${src.proclamationNumber}` : '',
                          src.articles ? `Kwt. ${src.articles}` : '',
                          src.jurisdiction,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {src.summary && (
                        <p className="text-[11px] text-slate-300 line-clamp-2">{src.summary}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default XiinxalaGalmeeView;
