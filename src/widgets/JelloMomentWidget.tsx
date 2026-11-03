import { HStack, Image, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { aspectRatio, clipped, containerBackground, font, foregroundStyle, frame, opacity, overlay, padding, resizable, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type JelloMomentWidgetProps = {
  sideOneUri: string;
  sideTwoUri: string;
  friendName: string;
  layout: 'left' | 'right' | 'top' | 'bottom';
  hasMoment: boolean;
};

const JelloMomentView = (props: JelloMomentWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const imageModifiers = [resizable(), aspectRatio({ contentMode: 'fill' }), frame({ maxWidth: 500, maxHeight: 500 }), clipped()];
  const first = props.sideOneUri ? <Image uiImage={props.sideOneUri} modifiers={imageModifiers} /> : <ZStack modifiers={[frame({ maxWidth: 500, maxHeight: 500 }), overlay({ color: '#F7B84B22' })]}><Text modifiers={[foregroundStyle('#7A6447')]}>Your side</Text></ZStack>;
  const second = props.sideTwoUri ? <Image uiImage={props.sideTwoUri} modifiers={imageModifiers} /> : <ZStack modifiers={[frame({ maxWidth: 500, maxHeight: 500 }), overlay({ color: '#19161211' })]}><Text modifiers={[foregroundStyle('#7A6447')]}>Their side</Text></ZStack>;
  const firstBeforeSecond = props.layout === 'left' || props.layout === 'top';
  const sides = props.layout === 'top' || props.layout === 'bottom'
    ? <VStack spacing={0}>{firstBeforeSecond ? first : second}{firstBeforeSecond ? second : first}</VStack>
    : <HStack spacing={0}>{firstBeforeSecond ? first : second}{firstBeforeSecond ? second : first}</HStack>;

  if (!props.hasMoment) {
    return <VStack alignment="leading" spacing={6} modifiers={[containerBackground('#FFF9ED', 'widget'), padding({ all: 16 }), widgetURL('jello://')]}>
      <Text modifiers={[font({ size: 22, weight: 'black', design: 'rounded' }), foregroundStyle('#F5A623')]}>JELLO</Text>
      <Text modifiers={[font({ textStyle: 'headline', weight: 'bold' }), foregroundStyle('#241B10')]}>Two people. Two moments.</Text>
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('#756954')]}>Open Jello to complete your first card.</Text>
    </VStack>;
  }

  return <ZStack modifiers={[containerBackground('#17130E', 'widget'), widgetURL('jello://moments')]}>
    {sides}
    <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: 500, maxHeight: 500, alignment: 'bottomLeading' }), padding({ all: environment.widgetFamily === 'systemSmall' ? 10 : 13 })]}>
      <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle('#FFFFFF'), opacity(0.95)]}>{props.friendName || 'Two Sides'}</Text>
    </VStack>
  </ZStack>;
};

export const JelloMomentWidget = createWidget<JelloMomentWidgetProps>('JelloMomentWidget', JelloMomentView);

export default JelloMomentWidget;
