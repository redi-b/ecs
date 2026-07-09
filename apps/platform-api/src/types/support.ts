export type SupportHistoryResult = {
  ok: true;
  history: {
    notes: SupportNote[];
    auditLogs: {
      id: string;
      actorUserId: string | null;
      action: string;
      targetType: string;
      targetId: string | null;
      metadata: unknown;
      createdAt: string;
    }[];
  };
};


export type SupportNote = {
  id: string;
  operatorUserId: string;
  body: string;
  visibility: string;
  createdAt: string;
};


export type SupportNoteCreateResult = {
  ok: true;
  note: SupportNote;
};
