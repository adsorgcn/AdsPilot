'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Divider from '~/core/ui/Divider';
import { Card, CardContent } from '~/components/ui/card';
import FadeIn from '~/components/FadeIn';
import { FadeInStagger, FadeInStaggerItem } from '~/components/FadeIn';
import { MarketingPageLayout } from '~/core/ui/PageLayout';
import classNames from 'clsx';

type RoadmapSection = {
  title: string;
  items: string[];
};

type ChangelogRelease = {
  version: string;
  date: string;
  highlights: string[];
};

export default function UpdatesPage() {
  const { t } = useTranslation('marketing');
  const [activeTab, setActiveTab] = useState<'roadmap' | 'changelog'>('roadmap');

  const roadmapSections = t('roadmap.sections', {
    returnObjects: true,
  }) as RoadmapSection[];

  const changelogReleases = t('changelog.releases', {
    returnObjects: true,
  }) as ChangelogRelease[];

  return (
    <MarketingPageLayout maxWidth="5xl">
      <div className="flex flex-col gap-12">
        <FadeIn>
          <header className="space-y-6 text-center">
            <Heading type={1}>{t('updates.hero.title')}</Heading>
            <SubHeading className="text-muted-foreground">
              {t('updates.hero.description')}
            </SubHeading>

            {/* Tab Navigation */}
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-muted/30 p-1">
              <button
                onClick={() => setActiveTab('roadmap')}
                className={classNames(
                  'rounded-full px-6 py-2 text-sm font-medium transition-all',
                  activeTab === 'roadmap'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('updates.tabs.roadmap')}
              </button>
              <button
                onClick={() => setActiveTab('changelog')}
                className={classNames(
                  'rounded-full px-6 py-2 text-sm font-medium transition-all',
                  activeTab === 'changelog'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('updates.tabs.changelog')}
              </button>
            </div>
          </header>
        </FadeIn>

        {/* Roadmap Content */}
        {activeTab === 'roadmap' && (
          <FadeInStagger className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {roadmapSections.map((section) => (
              <FadeInStaggerItem key={section.title} className="flex">
                <Card className="flex flex-col w-full">
                  <CardContent className="flex flex-col gap-4 p-6 flex-1">
                    <h2 className="text-lg font-semibold">
                      {section.title}
                    </h2>
                    <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                      {section.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        )}

        {/* Changelog Content */}
        {activeTab === 'changelog' && (
          <FadeInStagger className="space-y-8">
            {changelogReleases.map((release) => (
              <FadeInStaggerItem key={release.version}>
                <Card>
                  <CardContent className="p-8">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <h2 className="text-xl font-semibold">
                        {release.version}
                      </h2>
                      <span className="text-sm text-muted-foreground">{release.date}</span>
                    </div>
                    <Divider className="my-6" />
                    <ul className="space-y-3 text-sm text-muted-foreground">
                      {release.highlights.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        )}
      </div>
    </MarketingPageLayout>
  );
}
