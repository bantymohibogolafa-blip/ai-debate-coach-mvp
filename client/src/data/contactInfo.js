export const contactInfo = Object.freeze({
  emails: Object.freeze([
    Object.freeze({
      name: '王予明',
      role: 'Founder & Project Leader',
      value: '1507514823@qq.com'
    }),
    Object.freeze({
      name: '党梓豪',
      role: 'R&D Developer',
      value: 'dangzihao_2025@qq.com'
    })
  ]),
  wechat: Object.freeze({
    name: '党梓豪',
    value: 'Dzh18781352495'
  })
});

export const feedbackEmailSubject = '锋辩使用反馈';

export function getFeedbackMailto(email) {
  return `mailto:${email}?subject=${encodeURIComponent(feedbackEmailSubject)}`;
}
