export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type PublicUserProfile = Pick<UserProfile, "uid" | "email" | "displayName">;
