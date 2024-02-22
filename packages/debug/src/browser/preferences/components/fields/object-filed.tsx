import { getDefaultRegistry } from '@rjsf/core';
import { FieldProps, FormContextType, RJSFSchema, StrictRJSFSchema } from '@rjsf/utils';
import React, { useEffect } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';

import { ILaunchService } from '../../../../common';
import { LaunchService } from '../../launch.service';

const DefaultObjectField: any = getDefaultRegistry().fields.ObjectField;

export const ObjectField = <T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any>(
  props: FieldProps<T, S, F>,
) => {
  const launchService = useInjectable<LaunchService>(ILaunchService);
  const { idSchema, onChange } = props;

  useEffect(() => {
    const { $id } = idSchema;
    const disabled = new Disposable();

    // 仅处理 root 节点
    if ($id === 'root') {
      disabled.addDispose(launchService.onChangeFormData((newFormData) => onChange(newFormData as T)));
    }

    return () => disabled.dispose();
  }, [idSchema]);

  return <DefaultObjectField {...props} />;
};
