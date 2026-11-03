import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { widgetsDirectory } from 'expo-widgets';
import type { Moment } from '@/features/jello/api';
import { JelloMomentWidget } from '@/widgets/JelloMomentWidget';

async function cacheWidgetImage(url: string, name: string) {
  if (!widgetsDirectory) return '';
  const destination = new File(widgetsDirectory, name);
  const downloaded = await File.downloadFileAsync(url, destination, { idempotent: true });
  return downloaded.uri;
}

export async function syncLatestMomentToWidget(moments: Moment[]) {
  if (Platform.OS !== 'ios' || !widgetsDirectory) return;
  const latest = moments.find((moment) => moment.status === 'completed' && moment.side_one_url && moment.side_two_url);
  if (!latest?.side_one_url || !latest.side_two_url) {
    JelloMomentWidget.updateSnapshot({ sideOneUri: '', sideTwoUri: '', friendName: '', layout: 'left', hasMoment: false });
    return;
  }
  const [sideOneUri, sideTwoUri] = await Promise.all([
    cacheWidgetImage(latest.side_one_url, 'latest-side-one.jpg'),
    cacheWidgetImage(latest.side_two_url, 'latest-side-two.jpg'),
  ]);
  JelloMomentWidget.updateSnapshot({ sideOneUri, sideTwoUri, friendName: latest.other_display_name, layout: latest.layout, hasMoment: true });
}
