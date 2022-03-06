/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { defineComponent, PropType, ref, computed, onMounted, watch } from 'vue'
import Modal from '@/components/modal'
import { useI18n } from 'vue-i18n'
import {
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSwitch,
  NInputNumber,
  NDynamicInput,
  NCheckbox
} from 'naive-ui'
import { queryTenantList } from '@/service/modules/tenants'
import { SaveForm, WorkflowDefinition } from './types'
import { useRoute } from 'vue-router'
import { verifyName } from '@/service/modules/process-definition'
import './x6-style.scss'

const props = {
  visible: {
    type: Boolean as PropType<boolean>,
    default: false
  },
  // If this prop is passed, it means from definition detail
  definition: {
    type: Object as PropType<WorkflowDefinition>,
    default: undefined
  }
}

interface Tenant {
  tenantCode: string
  id: number
}

export default defineComponent({
  name: 'dag-save-modal',
  props,
  emits: ['update:show', 'save'],
  setup(props, context) {
    const route = useRoute()
    const { t } = useI18n()

    const projectCode = Number(route.params.projectCode)
    const tenants = ref<Tenant[]>([])
    const tenantsDropdown = computed(() => {
      if (tenants.value) {
        return tenants.value
          .map((t) => ({
            label: t.tenantCode,
            value: t.tenantCode
          }))
          .concat({ label: 'default', value: 'default' })
      }
      return []
    })
    onMounted(() => {
      queryTenantList().then((res: any) => {
        tenants.value = res
      })
    })

    const formValue = ref<SaveForm>({
      name: '',
      description: '',
      tenantCode: 'default',
      timeoutFlag: false,
      timeout: 0,
      globalParams: [],
      release: false
    })
    const formRef = ref()
    const rule = {
      name: {
        required: true,
        message: t('project.dag.dag_name_empty')
      },
      timeout: {
        validator() {
          if (formValue.value.timeoutFlag && formValue.value.timeout <= 0) {
            return new Error(t('project.dag.positive_integer'))
          }
        }
      },
      globalParams: {
        validator() {
          const props = new Set()
          for (const param of formValue.value.globalParams) {
            const prop = param.value
            if (!prop) {
              return new Error(t('project.dag.prop_empty'))
            }

            if (props.has(prop)) {
              return new Error(t('project.dag.prop_repeat'))
            }

            props.add(prop)
          }
        }
      }
    }
    const onSubmit = () => {
      formRef.value.validate(async (valid: any) => {
        if (!valid) {
          const params = {
            name: formValue.value.name
          }
          if (
            props.definition?.processDefinition.name !== formValue.value.name
          ) {
            verifyName(params, projectCode)
              .then(() => context.emit('save', formValue.value))
              .catch((error: any) => {
                window.$message.error(error.message)
              })
          } else {
            context.emit('save', formValue.value)
          }
        }
      })
    }
    const onCancel = () => {
      context.emit('update:show', false)
    }

    const updateModalData = () => {
      const process = props.definition?.processDefinition
      if (process) {
        formValue.value.name = process.name
        formValue.value.description = process.description
        formValue.value.tenantCode = process.tenantCode
        if (process.timeout && process.timeout > 0) {
          formValue.value.timeoutFlag = true
          formValue.value.timeout = process.timeout
        }
        formValue.value.globalParams = process.globalParamList.map((param) => ({
          key: param.prop,
          value: param.value
        }))
      }
    }

    onMounted(() => updateModalData())

    watch(
      () => props.definition?.processDefinition,
      () => updateModalData()
    )

    return () => (
      <Modal
        show={props.visible}
        title={t('project.dag.basic_info')}
        onConfirm={onSubmit}
        onCancel={onCancel}
        autoFocus={false}
      >
        <NForm
          label-width='100'
          model={formValue.value}
          rules={rule}
          size='medium'
          label-placement='left'
          ref={formRef}
        >
          <NFormItem label={t('project.dag.workflow_name')} path='name'>
            <NInput v-model:value={formValue.value.name} />
          </NFormItem>
          <NFormItem label={t('project.dag.description')} path='description'>
            <NInput
              type='textarea'
              v-model:value={formValue.value.description}
            />
          </NFormItem>
          <NFormItem label={t('project.dag.tenant')} path='tenantCode'>
            <NSelect
              options={tenantsDropdown.value}
              v-model:value={formValue.value.tenantCode}
            />
          </NFormItem>
          <NFormItem label={t('project.dag.timeout_alert')} path='timeoutFlag'>
            <NSwitch v-model:value={formValue.value.timeoutFlag} />
          </NFormItem>
          {formValue.value.timeoutFlag && (
            <NFormItem label=' ' path='timeout'>
              <NInputNumber
                v-model:value={formValue.value.timeout}
                show-button={false}
                min={0}
                v-slots={{
                  suffix: () => '分'
                }}
              ></NInputNumber>
            </NFormItem>
          )}
          <NFormItem
            label={t('project.dag.global_variables')}
            path='globalParams'
          >
            <NDynamicInput
              v-model:value={formValue.value.globalParams}
              preset='pair'
              key-placeholder={t('project.dag.key')}
              value-placeholder={t('project.dag.value')}
            />
          </NFormItem>
          {props.definition && (
            <NFormItem label=' ' path='timeoutFlag'>
              <NCheckbox v-model:checked={formValue.value.release}>
                {t('project.dag.online_directly')}
              </NCheckbox>
            </NFormItem>
          )}
        </NForm>
      </Modal>
    )
  }
})
