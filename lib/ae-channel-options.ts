/**
 * Canais oferecidos pela Calculadora AE (ids gravados na estimativa) e o
 * rótulo de cada um. Compartilhado pela tela de cálculo e pela página da
 * estimativa salva, para os dois mostrarem os mesmos nomes.
 */

type TFunc = (key: string, params?: Record<string, any>) => string;

export interface AEChannelOption {
  id: string;
  label: string;
}

export function aeChannelOptions(t: TFunc): { main: AEChannelOption[]; extra: AEChannelOption[] } {
  return {
    main: [
      { id: 'web_form', label: 'Web Form' },
      { id: 'email', label: 'Email' },
      { id: 'web_widget', label: 'Web Widget' },
      { id: 'whatsapp', label: 'WhatsApp' },
      { id: 'facebook', label: 'Facebook' },
      { id: 'instagram', label: 'Instagram' },
      { id: 'voice', label: 'Voice (Zendesk)' },
      { id: 'teams', label: 'MS Teams' },
      { id: 'slack', label: 'Slack' },
      { id: 'x_dm', label: 'X DMs' },
      { id: 'x_pages', label: t('channel.xPublic') },
      { id: 'sms', label: 'SMS/Text' },
    ],
    extra: [
      { id: 'ios', label: 'iOS' },
      { id: 'unity', label: 'Unity' },
      { id: 'line', label: 'LINE' },
      { id: 'apple_business', label: 'Apple Messages for Business' },
      { id: 'wechat', label: 'WeChat' },
      { id: 'google_rcs', label: 'Google RCS' },
      { id: 'google_business', label: t('channel.googleBusiness') },
      { id: 'kakaotalk', label: 'KakaoTalk' },
      { id: 'facebook_pages', label: t('channel.facebookPage') },
      { id: 'instagram_page', label: t('channel.instagramPage') },
      { id: 'telegram', label: 'Telegram' },
    ],
  };
}

/** Rótulo de um canal pelo id salvo (ids desconhecidos aparecem como estão). */
export function aeChannelLabel(id: string, t: TFunc): string {
  const { main, extra } = aeChannelOptions(t);
  return [...main, ...extra].find((c) => c.id === id)?.label || id;
}
