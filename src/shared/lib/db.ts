import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  createInitialProgress,
  DEFAULT_USER_SETTINGS,
  type MaterialReadState,
  type QuestionProgress,
  type StudySessionLog,
  type UserSettings,
} from "../../entities/progress";

/**
 * IndexedDB永続化層。docs/phase0-design.md 3.1節の役割分担に従い、
 * 学習履歴・模試履歴・復習情報の唯一の永続化先とする。
 * Zustandストアや画面コンポーネントはこの層を経由してのみ読み書きする。
 */

interface GKenteiDB extends DBSchema {
  questionProgress: {
    key: string;
    value: QuestionProgress;
  };
  studySessionLog: {
    key: string;
    value: StudySessionLog;
  };
  materialReadState: {
    key: string;
    value: MaterialReadState;
  };
  userSettings: {
    key: string;
    value: UserSettings;
  };
}

const DB_NAME = "g-kentei-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<GKenteiDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<GKenteiDB>> {
  dbPromise ??= openDB<GKenteiDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("questionProgress")) {
        db.createObjectStore("questionProgress", { keyPath: "questionId" });
      }
      if (!db.objectStoreNames.contains("studySessionLog")) {
        db.createObjectStore("studySessionLog", { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains("materialReadState")) {
        db.createObjectStore("materialReadState", { keyPath: "sectionId" });
      }
      if (!db.objectStoreNames.contains("userSettings")) {
        db.createObjectStore("userSettings", { keyPath: "id" });
      }
    },
  });
  return dbPromise;
}

export async function getQuestionProgress(questionId: string): Promise<QuestionProgress> {
  const db = await getDb();
  const existing = await db.get("questionProgress", questionId);
  return existing ?? createInitialProgress(questionId);
}

export async function saveQuestionProgress(progress: QuestionProgress): Promise<void> {
  const db = await getDb();
  await db.put("questionProgress", progress);
}

export async function listAllQuestionProgress(): Promise<QuestionProgress[]> {
  const db = await getDb();
  return db.getAll("questionProgress");
}

export async function getMaterialReadState(sectionId: string): Promise<MaterialReadState> {
  const db = await getDb();
  const existing = await db.get("materialReadState", sectionId);
  return existing ?? { sectionId, readAt: null };
}

export async function markSectionRead(sectionId: string): Promise<void> {
  const db = await getDb();
  await db.put("materialReadState", { sectionId, readAt: new Date().toISOString() });
}

export async function listAllMaterialReadState(): Promise<MaterialReadState[]> {
  const db = await getDb();
  return db.getAll("materialReadState");
}

export async function getUserSettings(): Promise<UserSettings> {
  const db = await getDb();
  const existing = await db.get("userSettings", DEFAULT_USER_SETTINGS.id);
  return existing ?? DEFAULT_USER_SETTINGS;
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const db = await getDb();
  await db.put("userSettings", settings);
}

export async function saveStudySessionLog(log: StudySessionLog): Promise<void> {
  const db = await getDb();
  await db.put("studySessionLog", log);
}

export async function listAllStudySessionLogs(): Promise<StudySessionLog[]> {
  const db = await getDb();
  return db.getAll("studySessionLog");
}

/** 設定画面のデータ初期化用。指定ストアをすべて空にする。 */
export async function clearAllData(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.clear("questionProgress"),
    db.clear("studySessionLog"),
    db.clear("materialReadState"),
    db.clear("userSettings"),
  ]);
}

export interface ExportedData {
  exportedAt: string;
  questionProgress: QuestionProgress[];
  studySessionLog: StudySessionLog[];
  materialReadState: MaterialReadState[];
  userSettings: UserSettings;
}

export async function exportAllData(): Promise<ExportedData> {
  const [questionProgress, studySessionLog, materialReadState, userSettings] = await Promise.all([
    listAllQuestionProgress(),
    listAllStudySessionLogs(),
    listAllMaterialReadState(),
    getUserSettings(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    questionProgress,
    studySessionLog,
    materialReadState,
    userSettings,
  };
}
