import { Host, Label, ShareLink } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, frame, tint } from '@expo/ui/swift-ui/modifiers';

type Props = { username: string };

export function NativeInviteButton({ username }: Props) {
  const clean = username.replace(/^@/, '');
  return <Host colorScheme="dark" seedColor="#FFB84D" style={{ height: 52 }}>
    <ShareLink
      item={`jello://friends?username=${encodeURIComponent(clean)}`}
      subject="Join me on Jello"
      message={`Add me on Jello as @${clean}. Two people. Two moments. One photo.`}
      modifiers={[buttonStyle('borderedProminent'), controlSize('large'), tint('#FFB84D'), frame({ maxWidth: Infinity, minHeight: 52 })]}
    >
      <Label title="Share your Jello" systemImage="square.and.arrow.up" />
    </ShareLink>
  </Host>;
}
