import {
  PreferenceProviderProvider,
  PreferenceScope,
  PreferenceService,
  PreferenceSchemaProvider,
  URI,
} from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { PreferenceSettingId } from '@opensumi/ide-preferences';
import { PREFERENCE_COMMANDS } from '@opensumi/ide-preferences/lib/browser/preference-contribution';
import {
  PreferenceSettingsService,
  defaultSettingGroup,
  defaultSettingSections,
} from '@opensumi/ide-preferences/lib/browser/preference-settings.service';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';


describe('PreferenceSettingService should be work', () => {
  let injector: MockInjector;
  let preferenceSettingsService: PreferenceSettingsService;

  let mockPreferenceSchemaProvider;
  let mockPreferenceService;
  let mockFileServiceClient;
  let mockUserPreferenceProvider;
  let mockResource;

  beforeAll(async (done) => {
    injector = createBrowserInjector([]);

    mockPreferenceSchemaProvider = {};

    mockPreferenceService = {
      set: jest.fn(),
      resolve: jest.fn(() => ({
        value: '',
        effectingScope: PreferenceScope.Default,
      })),
    };

    mockFileServiceClient = {
      access: jest.fn(() => false),
      createFile: jest.fn(() => ({})),
      setContent: jest.fn(),
    };

    mockResource = {
      uri: new URI('settings.json').toString(),
      isDirectory: false,
      lastModification: new Date().getTime(),
    };

    mockUserPreferenceProvider = {
      resource: Promise.resolve(mockResource),
    };

    injector.overrideProviders(
      {
        token: PreferenceService,
        useValue: mockPreferenceService,
      },
      {
        token: PreferenceSchemaProvider,
        useValue: mockPreferenceSchemaProvider,
      },
      {
        token: PreferenceProviderProvider,
        useValue: (scope: PreferenceScope) => {
          if (scope === PreferenceScope.User) {
            return mockUserPreferenceProvider;
          }
        },
      },
      {
        token: IFileServiceClient,
        useValue: mockFileServiceClient,
      },
      {
        token: PreferenceSettingsService,
        useClass: PreferenceSettingsService,
      },
    );

    preferenceSettingsService = injector.get(PreferenceSettingsService);

    done();
  });

  afterAll(async () => {
    injector.disposeAll();
  });

  describe('01 #Init', () => {
    it('should have enough API', async () => {
      expect(typeof preferenceSettingsService.currentGroup).toBe('string');
      expect(typeof preferenceSettingsService.currentSearch).toBe('string');
      expect(typeof preferenceSettingsService.setCurrentGroup).toBe('function');
      expect(typeof preferenceSettingsService.openJSON).toBe('function');
      expect(typeof preferenceSettingsService.setPreference).toBe('function');
      expect(typeof preferenceSettingsService.handleListHandler).toBe('function');
      expect(typeof preferenceSettingsService.getSettingGroups).toBe('function');
      expect(typeof preferenceSettingsService.registerSettingGroup).toBe('function');
      expect(typeof preferenceSettingsService.registerSettingSection).toBe('function');
      expect(typeof preferenceSettingsService.getSectionByPreferenceId).toBe('function');
      expect(typeof preferenceSettingsService.getSections).toBe('function');
      expect(typeof preferenceSettingsService.getPreference).toBe('function');
      expect(typeof preferenceSettingsService.getEnumLabels).toBe('function');
      expect(typeof preferenceSettingsService.setEnumLabels).toBe('function');
      expect(typeof preferenceSettingsService.reset).toBe('function');
      expect(typeof preferenceSettingsService.getPreferenceUrl).toBe('function');
      expect(typeof preferenceSettingsService.getCurrentPreferenceUrl).toBe('function');
      expect(typeof preferenceSettingsService.search).toBe('function');
    });
  });

  describe('02 #API should be work', () => {
    it('registerSettingGroup', () => {
      for (const group of defaultSettingGroup) {
        preferenceSettingsService.registerSettingGroup(group);
      }
    });

    it('registerSettingSection', () => {
      const keys = Object.keys(defaultSettingSections);
      for (const key of keys) {
        for (const section of defaultSettingSections[key]) {
          preferenceSettingsService.registerSettingSection(key, section);
        }
      }
    });

    it('openJSON', () => {
      const open = jest.fn();
      injector.mockCommand(PREFERENCE_COMMANDS.OPEN_SOURCE_FILE.id, open);
      preferenceSettingsService.openJSON(PreferenceScope.User, 'general.theme');
      expect(open).toBeCalledTimes(1);
    });

    it('setPreference', () => {
      preferenceSettingsService.setPreference('general.theme', 'ide-dark', PreferenceScope.User);
      expect(mockPreferenceService.set).toBeCalledTimes(1);
      mockPreferenceService.set.mockClear();
    });

    it('handleListHandler', () => {
      const handler = { open: () => {} };
      preferenceSettingsService.handleListHandler(handler);
      expect(preferenceSettingsService.listHandler).toEqual(handler);
    });

    it('getSettingGroups', () => {
      const sectionGroup = preferenceSettingsService.getSettingGroups(PreferenceScope.User);
      expect(sectionGroup.length).toBe(5);
    });

    it('getSectionByPreferenceId', () => {
      const section = preferenceSettingsService.getSectionByPreferenceId('general.theme');
      expect(section?.id).toBe('general.theme');
    });

    it('getSections', () => {
      const sections = preferenceSettingsService.getSections(PreferenceSettingId.General, PreferenceScope.User);
      expect(sections.length).toBe(1);
    });

    it('getPreference', () => {
      preferenceSettingsService.getPreference('general.theme', PreferenceScope.User);
      expect(mockPreferenceService.resolve).toBeCalledTimes(2);
    });

    it('getEnumLabels', () => {
      const labels = preferenceSettingsService.getEnumLabels('files.eol');
      expect(labels).toBeDefined();
    });

    it('reset', () => {
      preferenceSettingsService.reset('general.theme', PreferenceScope.User);
      expect(mockPreferenceService.set).toBeCalledTimes(1);
      mockPreferenceService.set.mockClear();
    });

    it('getPreferenceUrl', async () => {
      const uri = await preferenceSettingsService.getPreferenceUrl(PreferenceScope.User);
      expect(uri).toBe(mockResource.uri);
    });

    it('getCurrentPreferenceUrl', async () => {
      const uri = await preferenceSettingsService.getCurrentPreferenceUrl();
      expect(uri).toBe(mockResource.uri);
      expect(mockFileServiceClient.access).toBeCalledTimes(1);
      expect(mockFileServiceClient.createFile).toBeCalledTimes(1);
      expect(mockFileServiceClient.setContent).toBeCalledTimes(1);
    });

    it('search', () => {
      preferenceSettingsService.search('general');
      expect(preferenceSettingsService.currentSearch).toBe('general');
    });
  });
});
