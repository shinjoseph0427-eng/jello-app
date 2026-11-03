import { LegalPage } from '@/components/LegalPage';

const sections = [
  { title: '1. Using Jello', paragraphs: ['You must be at least 13 years old, or the minimum age required in your country, and able to agree to these terms. You are responsible for your account, the accuracy of information you provide, and activity performed through your account.'] },
  { title: '2. Your content', paragraphs: ['You keep ownership of photos and other content you submit. You grant Jello a limited, worldwide license to host, process, reproduce, and transmit that content only as necessary to operate, secure, and improve the service.', 'Only share content you have the right to use. Consider the privacy of every person shown in a photo before sending it.'] },
  { title: '3. Acceptable use', paragraphs: ['Do not use Jello to harass, threaten, impersonate, exploit minors, distribute illegal or intimate content without consent, spam, evade blocks, access another account, probe the service, or interfere with its operation. We may remove content or restrict accounts to protect people and the service.'] },
  { title: '4. Private moments and future features', paragraphs: ['Two Sides moments are private by default. If Jello later offers public sharing or recommendations, publishing will require an explicit action and may be subject to additional visibility and moderation controls.'] },
  { title: '5. Service changes', paragraphs: ['Jello is an evolving service. Features may change, pause, or end. We may release updates that are required for security or compatibility. We will use reasonable care but do not guarantee uninterrupted or error-free operation.'] },
  { title: '6. Suspension and deletion', paragraphs: ['You may stop using Jello or delete your account at any time. We may suspend or terminate access when reasonably necessary for safety, legal compliance, repeated violations, or protection of the service.'] },
  { title: '7. Disclaimers and liability', paragraphs: ['Jello is provided “as is” to the extent permitted by law. We disclaim implied warranties that can legally be disclaimed. To the extent permitted by law, Jello and its operators are not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the service.'] },
  { title: '8. Governing terms', paragraphs: ['These terms are governed by the laws of California, excluding conflict-of-law rules, except where your local consumer law requires otherwise. If one provision is unenforceable, the remaining provisions continue in effect.'] },
  { title: '9. Contact', paragraphs: ['Questions about these terms can be sent to support@jello.app.'] },
];

export default function TermsOfService() { return <LegalPage title="Terms of service" summary="Jello is for sharing genuine moments with people you trust. These terms keep that experience safe, private, and fair." sections={sections} />; }
