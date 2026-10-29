/**
 * Chaves de canal da Calculadora AE ('Calculadora AE' rows 13-35, in sheet
 * order). Ficam num módulo próprio para que `ae-engine` e `ae-config` possam
 * usá-las sem importar um ao outro.
 */
export const CHANNEL_KEYS = [
  'email', // B13
  'web_form', // B14
  'facebook_pages', // B15
  'x_pages', // B16
  'microsoft_teams', // B17
  'web_widget', // B18
  'facebook_messenger', // B19
  'slack', // B20
  'x_dm', // B21
  'sms', // B22
  'voice', // B23
  'ios', // B24
  'unity', // B25
  'line', // B26
  'apple_messages', // B27
  'wechat', // B28
  'google_rcs', // B29
  'google_business_messages', // B30
  'kakaotalk', // B31
  'telegram', // B32
  'whatsapp', // B33
  'instagram_page', // B34
  'instagram_dm', // B35
] as const;

export type ChannelKey = (typeof CHANNEL_KEYS)[number];
