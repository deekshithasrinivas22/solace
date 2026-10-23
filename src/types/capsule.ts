export type TimeCapsule = {
  id: string;
  title: string;
  unlockAt: string;
  createdAt: string | null;
  isUnlocked: boolean;
  message?: string;
};

export type TimeCapsuleInput = {
  title: string;
  message: string;
  unlockAt: string;
};
