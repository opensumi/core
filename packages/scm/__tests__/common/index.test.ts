import { MockSCMProvider } from '../scm-test-util';

import { SCMService, InputValidationType } from '../../src/common';

describe('scm service', () => {
  let service: SCMService;

  beforeEach(() => {
    service = new SCMService();
  });

  describe('registerSCMProvider', () => {
    it('single repository works', async () => {
      // basic completeness checking
      const repoDispose = jest.fn();
      const mockProvider = new (class extends MockSCMProvider {
        dispose = repoDispose;
      })(0);
      service.registerSCMProvider(mockProvider);

      expect(service.repositories.length === 1);
      // 添加进来的首个 repo 默认被选中
      expect(service.repositories[0].selected).toBeTruthy();

      // repo 实例测试
      const repo = service.repositories[0];

      // repo selection
      const repoSelectListner = jest.fn();
      repo.onDidChangeSelection(repoSelectListner);

      repo.setSelected(false);
      expect(repo.selected).toBeFalsy();
      // test for SCMRepository#onDidFocus
      expect(repoSelectListner).toHaveBeenCalled();
      expect(repoSelectListner.mock.calls.length).toBe(1);
      expect(repoSelectListner.mock.calls[0][0]).toEqual(repo);

      // repo focus
      const repoFocusListener = jest.fn();
      repo.onDidFocus(repoFocusListener);

      repo.focus();
      // test for SCMRepository#onDidFocus
      expect(repoFocusListener).toHaveBeenCalledTimes(1);
      expect(repoFocusListener.mock.calls[0][0]).toBeUndefined();

      // repo dispose
      repo.dispose();
      expect(repoDispose).toHaveBeenCalledTimes(1);
    });

    it('scm input works', async () => {
      service.registerSCMProvider(new MockSCMProvider(0));
      // repo 下的 scmInput 实例测试
      const scmInput = service.repositories[0].input;
      // input value
      expect(scmInput.value).toBe('');
      const inputChangeListener = jest.fn();
      scmInput.onDidChange(inputChangeListener);

      scmInput.value = 'input-value';
      expect(scmInput.value).toBe('input-value');
      // test for SCMInput#onDidChange
      expect(inputChangeListener).toHaveBeenCalledTimes(1);
      expect(inputChangeListener.mock.calls[0][0]).toBe('input-value');

      // input placeholder
      expect(scmInput.placeholder).toBe('');
      const inputPlacholderChangeListener = jest.fn();
      scmInput.onDidChangePlaceholder(inputPlacholderChangeListener);

      scmInput.placeholder = 'input-placeholder';
      expect(scmInput.placeholder).toBe('input-placeholder');
      // test for SCMInput#onDidChangePlaceholder
      expect(inputPlacholderChangeListener).toHaveBeenCalledTimes(1);
      expect(inputPlacholderChangeListener.mock.calls[0][0]).toBe('input-placeholder');

      // input visible
      expect(scmInput.visible).toBeTruthy();
      const inputVisibleListener = jest.fn();
      scmInput.onDidChangeVisibility(inputVisibleListener);

      scmInput.visible = false;
      expect(scmInput.visible).toBeFalsy();
      // test for SCMInput#onDidChangeVisibility
      expect(inputVisibleListener).toHaveBeenCalledTimes(1);
      expect(inputVisibleListener.mock.calls[0][0]).toBeFalsy();

      // input validateInput
      expect(scmInput.validateInput('abc', 0)).resolves.toBeUndefined();
      const inputValidatorListener = jest.fn();
      scmInput.onDidChangeValidateInput(inputValidatorListener);

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
      service.onDidAddRepository(addRepoListener);

      const changeSelectedRepoListener = jest.fn();
      service.onDidChangeSelectedRepositories(changeSelectedRepoListener);

      const repo1 = service.registerSCMProvider(scmProvider1);
      const repo2 = service.registerSCMProvider(scmProvider2);

      expect(repo1.provider).toEqual(scmProvider1);
      expect(repo2.provider).toEqual(scmProvider2);

      expect(addRepoListener).toHaveBeenCalledTimes(2);
      expect(addRepoListener.mock.calls[0][0]).toEqual(repo1);
      expect(addRepoListener.mock.calls[1][0]).toEqual(repo2);

      expect(service.repositories.length === 2);
      expect(service.repositories.map((n) => n.selected)).toEqual([true, false]);

      // 只会默认选中一个 repo
      expect(changeSelectedRepoListener).toHaveBeenCalledTimes(1);
      expect(changeSelectedRepoListener.mock.calls[0][0].length).toBe(1);
      expect(changeSelectedRepoListener.mock.calls[0][0][0].provider).toEqual(scmProvider1);

      service.repositories[1].setSelected(true);
      expect(service.repositories.map((n) => n.selected)).toEqual([false, true]);

      expect(changeSelectedRepoListener).toHaveBeenCalledTimes(2);
      expect(changeSelectedRepoListener.mock.calls[1][0].length).toBe(1);
      expect(changeSelectedRepoListener.mock.calls[1][0][0].provider).toEqual(scmProvider2);

      const removeRepoListener = jest.fn();
      service.onDidRemoveRepository(removeRepoListener);

      // 2rd repo disposed
      service.repositories[1].dispose();
      expect(service.repositories.length).toBe(1);
      // 移除当前选中 repo 时会默认选中另外一个 repo
      expect(service.repositories[0].selected).toBeTruthy();
      expect(changeSelectedRepoListener).toHaveBeenCalledTimes(3);
      expect(changeSelectedRepoListener.mock.calls[2][0].length).toBe(1);
      expect(changeSelectedRepoListener.mock.calls[2][0][0].provider).toEqual(scmProvider1);

      // test for onDidRemoveRepository
      expect(removeRepoListener).toHaveBeenCalledTimes(1);
      expect(removeRepoListener.mock.calls[0][0]).toEqual(repo2);

      // 1st repo disposed
      service.repositories[0].dispose();
      expect(service.repositories.length).toBe(0);

      // test for onDidRemoveRepository
      expect(removeRepoListener).toHaveBeenCalledTimes(2);
      expect(removeRepoListener.mock.calls[1][0]).toEqual(repo1);
    });

    it('duplicate provider id', () => {
      const scmProvider1 = new MockSCMProvider(1);

      service.registerSCMProvider(scmProvider1);

      try {
        service.registerSCMProvider(scmProvider1);
      } catch (err) {
        expect(err.message).toBe('SCM Provider scm_id_1 already exists.');
      }
    });
  });
});
