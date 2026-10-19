export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Settings: undefined;
};

export type CategoriesStackParamList = {
  CategoriesMain: undefined;
  CategoryDetail: { id: string; title: string };
};

export type NotesStackParamList = {
  NotesMain: { focusSearch?: boolean } | undefined;
  NoteEditor: { id?: string; isNew?: boolean };
};

export type ChatStackParamList = {
  ChatList: undefined;
  ChatMain: { chatId?: number; sourceNoteIds?: number[] } | undefined;
  SourceSelector: { chatId?: number; selectedIds: number[] };
};

export type TabParamList = {
  Home: undefined;
  Categories: undefined;
  Notes: undefined;
  Chat: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
