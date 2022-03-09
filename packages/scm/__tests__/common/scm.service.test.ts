import { DisposableCollection } from '@opensumi/ide-core-common';

import { SCMService, InputValidationType } from '../../src/common';
import { MockSCMProvider } from '../scm-test-util';


describe('scm service', () => {
  let scmService: SCMService;

  const toTearDown = new DisposableCollection();

  beforeEach(() => {
    scmService = new SCMService();
  });

  afterEach(() => toTearDown.dispose());

  describe('registerSCMProvider', () => {
    it('single repository works', async () => {
      // basic completeness checking
      const repoDispose = jest.fn();
      const mockProvider = new (class extends MockSCMProvider {
        dispose = repoDispose;
      })(0);
      scmService.registerSCMProvider(mockProvider);

      expect(scmService.repositories.length === 1);
      // 添加进来的首个 repo 默认被选中
      expect(scmService.repositories[0].selected).toBeTruthy();

      // repo 实例测试
      const repo = scmService.repositories[0];

      // repo selection
      const repoSelectListner = jest.fn();
      toTearDown.push(repo.onDidChangeSelection(repoSelectListner));

      repo.setSelected(false);
      expect(repo.selected).toBeFalsy();
      // test for SCMRepository#onDidFocus
      expect(repoSelectListner).toHaveBeenCalled();
      expect(repoSelectListner.mock.calls.length).toBe(1);
      expect(repoSelectListner.mock.calls[0][0]).toEqual(repo);

      // repo focus
      const repoFocusListener = jest.fn();
      toTearDown.push(repo.onDidFocus(repoFocusListener));

      repo.focus();
      // test for SCMRepository#onDidFocus
      expect(repoFocusListener).toHaveBeenCalledTimes(1);
      expect(repoFocusListener.mock.calls[0][0]).toBeUndefined();

      // repo dispose
      repo.dispose();
      expect(repoDispose).toHaveBeenCalledTimes(1);
      expect(scmService.repositories.length).toBe(0);
    });

    it('two repositories works', async () => {
      // basic completeness checking
      const repoDispose = jest.fn();
      const mockProvider = new (class extends MockSCMProvider {
        dispose = repoDispose;
      })(0);
      scmService.registerSCMProvider(mockProvider);

      // 前置空白 repo
      scmService.registerSCMProvider(new MockSCMProvider(1));

      expect(scmService.repositories.length === 2);
      // 添加进来的首个 repo 默认被选中
      expect(scmService.repositories[0].selected).toBeTruthy();

      // repo 实例测试
      const repo0 = scmService.repositories[0];

      // repo0 selection
      const repoSelectListner = jest.fn();
      toTearDown.push(scmService.onDidChangeSelectedRepositories(repoSelectListner));
      // re-select
      repo0.setSelected(true);
      expect(repo0.selected).toBeTruthy();
      // test for SCMRepository#onDidFocus
      expect(repoSelectListner).toHaveBeenCalledTimes(0);

      // repo0 dispose
      repo0.dispose();
      expect(repoDispose).toHaveBeenCalledTimes(1);
      expect(scmService.repositories.length).toBe(1);

      // dispose called again: but make no sense
      repo0.dispose();
      expect(repoDispose).toHaveBeenCalledTimes(2);
      expect(scmService.repositories.length).toBe(1);
    });

    it('scm input works', async () => {
      scmService.registerSCMProvider(new MockSCMProvider(0));
      // repo 下的 scmInput 实例测试
      const scmInput = scmService.repositories[0].input;
      // input value
      expect(scmInput.value).toBe('');
      const inputChangeListener = jest.fn();
      toTearDown.push(scmInput.onDidChange(inputChangeListener));

      scmInput.value = 'input-value';
      expect(scmInput.value).toBe('input-value');
      // test for SCMInput#onDidChange
      expect(inputChangeListener).toHaveBeenCalledTimes(1);
      expect(inputChangeListener.mock.calls[0][0]).toBe('input-value');

      // input placeholder
      expect(scmInput.placeholder).toBe('');
      const inputPlacholderChangeListener = jest.fn();
      toTearDown.push(scmInput.onDidChangePlaceholder(inputPlacholderChangeListener));

      scmInput.placeholder = 'input-placeholder';
      expect(scmInput.placeholder).toBe('input-placeholder');
      // test for SCMInput#onDidChangePlaceholder
      expect(inputPlacholderChangeListener).toHaveBeenCalledTimes(1);
      expect(inputPlacholderChangeListener.mock.calls[0][0]).toBe('input-placeholder');

      // input visible
      expect(scmInput.visible).toBeTruthy();
      const inputVisibleListener = jest.fn();
      toTearDown.push(scmInput.onDidChangeVisibility(inputVisibleListener));

      scmInput.visible = false;
      expect(scmInput.visible).toBeFalsy();
      // test for SCMInput#onDidChangeVisibility
      expect(inputVisibleListener).toHaveBeenCalledTimes(1);
      expect(inputVisibleListener.mock.calls[0][0]).toBeFalsy();

      // input validateInput
      expect(scmInput.validateInput('abc', 0)).resolves.toBeUndefined();
      const inputValidatorListener = jest.fn();
      toTearDown.push(scmInput.onDidChangeValidateInput(inputValidatorListener));

      // test for input validator
      const invalidRet = {
        message: 'Invalid value',
        type: InputValidationType.Error,
      };
      const inputValidator = jest.fn().mockResolvedValue(invalidRet);
      scmInput.validateInput = inputValidator;
      expect(scmInput.validateInput('abc', 0)).resolves.toEqual(invalidRet);
      expect(inputValidator).toHaveBeenCalledTimes(1);
      expect(inputValidator.mock.calls[0]).toEqual(['abc', 0]);
      // test for SCMInput#onDidChangeValidateInput
      expect(inputValidatorListener).toHaveBeenCalledTimes(1);
      expect(inputValidatorListener.mock.calls[0][0]).toBeUndefined();
    });

    it('multi repos', () => {
      const scmProvider1 = new MockSCMProvider(1);
      const scmProvider2 = new MockSCMProvider(2);

      const addRepoListener = jest.fn();
      toTearDown.push(scmService.onDidAddRepository(addRepoListener));

      const changeSelectedRepoListener = jest.fn();
      toTearDown.push(scmService.onDidChangeSelectedRepositories(changeSelectedRepoListener));

      const repo1 = scmService.registerSCMProvider(scmProvider1);
      const repo2 = scmService.registerSCMProvider(scmProvider2);

      expect(repo1.provider).toEqual(scmProvider1);
      expect(repo2.provider).toEqual(scmProvider2);

      expect(addRepoListener).toHaveBeenCalledTimes(2);
      expect(addRepoListener.mock.calls[0][0]).toEqual(repo1);
      expect(addRepoListener.mock.calls[1][0]).toEqual(repo2);

      expect(scmService.repositories.length === 2);
      expect(scmService.repositories.map((n) => n.selected)).toEqual([true, false]);

      // 只会默认选中一个 repo
      expect(changeSelectedRepoListener).toHaveBeenCalledTimes(1);
      expect(changeSelectedRepoListener.mock.calls[0][0].length).toBe(1);
      expect(changeSelectedRepoListener.mock.calls[0][0][0].provider).toEqual(scmProvider1);

      scmService.repositories[1].setSelected(true);
      expect(scmService.repositories.map((n) => n.selected)).toEqual([false, true]);

      expect(changeSelectedRepoListener).toHaveBeenCalledTimes(2);
      expect(changeSelectedRepoListener.mock.calls[1][0].length).toBe(1);
      expect(changeSelectedRepoListener.mock.calls[1][0][0].provider).toEqual(scmProvider2);

      const removeRepoListener = jest.fn();
      toTearDown.push(scmService.onDidRemoveRepository(removeRepoListener));

      // 2rd repo disposed
      scmService.repositories[1].dispose();
      expect(scmService.repositories.length).toBe(1);
      // 移除当前选中 repo 时会默认选中另外一个 repo
      expect(scmService.repositories[0].selected).toBeTruthy();
      expect(changeSelectedRepoListener).toHaveBeenCalledTimes(3);
      expect(changeSelectedRepoListener.mock.calls[2][0].length).toBe(1);
      expect(changeSelectedRepoListener.mock.calls[2][0][0].provider).toEqual(scmProvider1);

      // test for onDidRemoveRepository
      expect(removeRepoListener).toHaveBeenCalledTimes(1);
      expect(removeRepoListener.mock.calls[0][0]).toEqual(repo2);

      // 1st repo disposed
      scmService.repositories[0].dispose();
      expect(scmService.repositories.length).toBe(0);

      // test for onDidRemoveRepository
      expect(removeRepoListener).toHaveBeenCalledTimes(2);
      expect(removeRepoListener.mock.calls[1][0]).toEqual(repo1);
    });

    it('duplicate provider id', () => {
      const scmProvider1 = new MockSCMProvider(1);

      scmService.registerSCMProvider(scmProvider1);

      try {
        scmService.registerSCMProvider(scmProvider1);
      } catch (err) {
        expect(err.message).toBe('SCM Provider scm_id_1 already exists.');
      }
    });
  });
});
