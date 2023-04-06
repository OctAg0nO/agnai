import { Component, createEffect, createMemo, createSignal, Show } from 'solid-js'
import { AlertTriangle, RefreshCw, Save } from 'lucide-solid'
import Button from '../../shared/Button'
import PageHeader from '../../shared/PageHeader'
import TextInput from '../../shared/TextInput'
import { adaptersToOptions, getFormEntries, getStrictForm } from '../../shared/util'
import Select, { Option } from '../../shared/Select'
import { CHAT_ADAPTERS, ChatAdapter, HordeModel, AIAdapter } from '../../../common/adapters'
import { settingStore, userStore } from '../../store'
import Divider from '../../shared/Divider'
import { DefaultPresets } from './DefaultPresets'
import { AppSchema } from '../../../srv/db/schema'
import UISettings from './UISettings'
import Tabs from '../../shared/Tabs'
import WorkerModal from './WorkerModal'
import Loading from '../../shared/Loading'
import Modal from '../../shared/Modal'

const settingTabs = {
  ai: 'AI Settings',
  ui: 'UI Settings',
  service: 'Presets',
}

type Tab = keyof typeof settingTabs

type DefaultAdapter = Exclude<ChatAdapter, 'default'>

const adapterOptions = CHAT_ADAPTERS.filter((adp) => adp !== 'default') as DefaultAdapter[]

const Settings: Component = () => {
  const state = userStore()
  const cfg = settingStore()

  createEffect(() => {
    refreshHorde()
  })

  const [workers, setWorkers] = createSignal<Option[]>()
  const [show, setShow] = createSignal(false)
  const [usage, setUsage] = createSignal(false)
  const [tab, setTab] = createSignal(0)

  const tabs = ['ai', 'ui', 'service'] satisfies Tab[]
  const currentTab = createMemo(() => tabs[tab()])

  const refreshHorde = () => {
    settingStore.getHordeModels()
    settingStore.getHordeWorkers()
  }

  const showUsage = () => {
    userStore.openaiUsage()
    setUsage(true)
  }

  const onSubmit = (evt: Event) => {
    const body = getStrictForm(evt, {
      koboldUrl: 'string?',
      novelApiKey: 'string?',
      novelModel: 'string?',
      hordeKey: 'string?',
      hordeModel: 'string?',
      luminaiUrl: 'string?',
      oaiKey: 'string?',
      scaleApiKey: 'string?',
      scaleUrl: 'string?',
      claudeApiKey: 'string?',
      defaultAdapter: adapterOptions,
    } as const)

    const defaultPresets = getFormEntries(evt)
      .filter(([name]) => name.startsWith('preset.'))
      .map(([name, value]) => {
        return { adapter: name.replace('preset.', '') as AIAdapter, presetId: value }
      })
      .reduce((prev, curr) => {
        prev![curr.adapter] = curr.presetId
        return prev
      }, {} as AppSchema.User['defaultPresets'])

    userStore.updateConfig({
      ...body,
      hordeWorkers: workers()?.map((w) => w.value) || state.user?.hordeWorkers || [],
      defaultPresets,
    })
  }

  const hordeName = createMemo(
    () => {
      if (state.user?.hordeName) return `Logged in as ${state.user.hordeName}.`
      return `Currently using anonymous access.`
    },
    { equals: false }
  )

  const novelVerified = createMemo(
    () => (state.user?.novelVerified ? 'API Key has been verified' : ''),
    { equals: false }
  )

  const HordeHelpText = (
    <>
      <span>{hordeName()}</span>
      <br />
      <span>
        Leave blank to use guest account. Visit{' '}
        <a class="link" href="https://aihorde.net" target="_blank">
          stablehorde.net
        </a>{' '}
        to register.
      </span>
    </>
  )

  const tabClass = `flex flex-col gap-4`

  return (
    <>
      <PageHeader title="Settings" subtitle="Configuration" noDivider />
      <div class="my-2">
        <Tabs tabs={tabs.map((t) => settingTabs[t])} selected={tab} select={setTab} />
      </div>
      <form onSubmit={onSubmit} autocomplete="off">
        <div class="flex flex-col gap-4">
          <div class={currentTab() === 'ui' ? tabClass : 'hidden'}>
            <UISettings />
          </div>

          <div class={currentTab() === 'service' ? tabClass : 'hidden'}>
            <DefaultPresets />
          </div>

          <div class={currentTab() === 'ai' ? tabClass : 'hidden'}>
            <Select
              fieldName="defaultAdapter"
              label="Default AI Service"
              items={adaptersToOptions(cfg.config.adapters)}
              helperText="The default service conversations will use unless otherwise configured"
              value={state.user?.defaultAdapter}
            />

            <Show when={cfg.config.adapters.includes('horde')}>
              <Divider />
              <h3 class="text-lg font-bold">AI Horde settings</h3>
              <TextInput
                fieldName="hordeKey"
                label="AI Horde API Key"
                helperText={HordeHelpText}
                placeholder={
                  state.user?.hordeName || state.user?.hordeKey ? 'API key has been verified' : ''
                }
                type="password"
                value={state.user?.hordeKey}
              />

              <Show when={state.user?.hordeName}>
                <Button schema="red" class="w-max" onClick={() => userStore.deleteKey('horde')}>
                  Delete Horde API Key
                </Button>
              </Show>

              <div class="flex justify-between">
                <div class="w-fit">
                  <Select
                    fieldName="hordeModel"
                    helperText={<span>Currently set to: {state.user?.hordeModel || 'None'}</span>}
                    label="Horde Model"
                    value={state.user?.hordeModel}
                    items={[{ label: 'Any', value: 'any' }].concat(...cfg.models.map(toItem))}
                  />
                </div>
                <div class="icon-button flex items-center" onClick={refreshHorde}>
                  <RefreshCw />
                </div>
              </div>
              <div class="flex items-center gap-4">
                <Button onClick={() => setShow(true)}>Select Specific Workers</Button>
                <div>
                  Workers selected: {workers()?.length ?? state.user?.hordeWorkers?.length ?? '0'}
                </div>
              </div>
            </Show>

            <Show when={cfg.config.adapters.includes('kobold')}>
              <Divider />
              <TextInput
                fieldName="koboldUrl"
                label="Kobold Compatible URL"
                helperText="Fully qualified URL. This URL must be publicly accessible."
                placeholder="E.g. https://local-tunnel-url-10-20-30-40.loca.lt"
                value={state.user?.koboldUrl}
              />
            </Show>

            <Show when={cfg.config.adapters.includes('openai')}>
              <Divider />
              <TextInput
                fieldName="oaiKey"
                label="OpenAI Key"
                helperText={
                  <>
                    Valid OpenAI Key.{' '}
                    <a class="link" onClick={showUsage}>
                      View Usage
                    </a>
                  </>
                }
                placeholder={
                  state.user?.oaiKeySet
                    ? 'OpenAI key is set'
                    : 'E.g. sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
                }
                type="password"
                value={state.user?.oaiKey}
              />
              <Button schema="red" class="w-max" onClick={() => userStore.deleteKey('openai')}>
                Delete OpenAI Key
              </Button>
            </Show>

            <Show when={cfg.config.adapters.includes('claude')}>
              <Divider />
              <TextInput
                fieldName="claudeApiKey"
                label="Claude Key"
                helperText="Valid Claude Key."
                placeholder={
                  state.user?.claudeApiKeySet
                    ? 'Claude key is set'
                    : 'E.g. sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
                }
                type="password"
                value={state.user?.claudeApiKey}
              />
              <Button schema="red" class="w-max" onClick={() => userStore.deleteKey('claude')}>
                Delete Claude Key
              </Button>
            </Show>

            <Show when={cfg.config.adapters.includes('scale')}>
              <Divider />
              <TextInput
                fieldName="scaleUrl"
                label="Scale URL"
                helperText="Fully qualified Scale URL."
                placeholder={'E.g. https://dashboard.scale.com/spellbook/api/v2/deploy/a1b2c3'}
                value={state.user?.scaleUrl}
              />
              <TextInput
                fieldName="scaleApiKey"
                label="Scale API Key"
                placeholder={
                  state.user?.scaleApiKeySet
                    ? 'Scale API key is set'
                    : 'E.g. 9rv440nv7ogj6s7j312flqijd'
                }
                type="password"
                value={state.user?.scaleApiKey}
              />
              <Button schema="red" class="w-max" onClick={() => userStore.deleteKey('scale')}>
                Delete Scale API Key
              </Button>
            </Show>

            <Show when={cfg.config.adapters.includes('novel')}>
              <Divider />
              <h3 class="text-xl">NovelAI settings</h3>
              <Select
                fieldName="novelModel"
                label="NovelAI Model"
                items={[
                  { label: 'Euterpe', value: 'euterpe-v2' },
                  { label: 'Krake', value: 'krake-v2' },
                ]}
                value={state.user?.novelModel}
              />
              <TextInput
                fieldName="novelApiKey"
                label="Novel API Key"
                type="password"
                value={state.user?.novelApiKey}
                helperText={
                  <>
                    NEVER SHARE THIS WITH ANYBODY! The token from the NovelAI request authorization.
                    Please note that this token expires periodically. You will occasionally need to
                    re-enter this token. headers.{' '}
                    <a
                      class="link"
                      target="_blank"
                      href="https://github.com/luminai-companion/agn-ai/blob/dev/instructions/novel.md"
                    >
                      Instructions
                    </a>
                    .
                  </>
                }
                placeholder={novelVerified()}
              />
              <Show when={state.user?.novelVerified}>
                <Button schema="red" class="w-max" onClick={() => userStore.deleteKey('novel')}>
                  Delete Novel API Key
                </Button>
              </Show>
            </Show>

            <Show when={cfg.config.adapters.includes('luminai')}>
              <Divider />
              <TextInput
                fieldName="luminaiUrl"
                label="LuminAI URL"
                helperText="Fully qualified URL. This URL must be publicly accessible."
                placeholder="E.g. https://local-tunnel-url-10-20-30-40.loca.lt"
                value={state.user?.luminaiUrl}
              />
            </Show>
            <Show when={!state.loggedIn}>
              <div class="mt-8 mb-4 flex w-full flex-col items-center justify-center">
                <div>This cannot be undone!</div>
                <Button class="bg-red-600" onClick={userStore.clearGuestState}>
                  <AlertTriangle /> Delete Guest State <AlertTriangle />
                </Button>
              </div>
            </Show>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-4">
          <Button type="submit">
            <Save />
            Update Settings
          </Button>
        </div>
        <WorkerModal show={show()} close={() => setShow(false)} save={setWorkers} />
        <OpenAIUsageModal show={usage()} close={() => setUsage(false)} />
      </form>
    </>
  )
}

export default Settings

const OpenAIUsageModal: Component<{ show: boolean; close: () => void }> = (props) => {
  const state = userStore((s) => s.metadata)
  const value = createMemo(() => {
    if (!state.openaiUsage) 'unknown'

    const amount = Math.round(state.openaiUsage!) / 100
    return `$${amount}`
  })

  return (
    <Modal title="OpenAI Usage" show={props.show} close={props.close}>
      <div class="flex">
        <div class="mr-4">Usage this month: </div>
        <div>
          <Show when={!state.openaiUsage}>
            <Loading />
          </Show>
          <Show when={!!state.openaiUsage}>{value()}</Show>
        </div>
      </div>
    </Modal>
  )
}

function toItem(model: HordeModel) {
  return {
    label: `${model.name} - (queue: ${model.queued}, eta: ${model.eta}, count: ${model.count})`,
    value: model.name,
  }
}
