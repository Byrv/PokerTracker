export type UserId = string & { readonly __brand: 'UserId' };
export type SessionId = string & { readonly __brand: 'SessionId' };
export type Paise = number & { readonly __brand: 'Paise' };
export type Chips = number & { readonly __brand: 'Chips' };
export type Permission = 'house' | 'participant' | 'none';
export type ChipRatio = { chipsPerPaise: number };

export const asUserId = (s: string) => s as UserId;
export const asSessionId = (s: string) => s as SessionId;
export const asPaise = (n: number) => n as Paise;
export const asChips = (n: number) => n as Chips;
