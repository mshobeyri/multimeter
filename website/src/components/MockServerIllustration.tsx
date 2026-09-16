import VSCodeDemoFrame, {
  VSCodeEditorTabs,
  YamlEditorPane,
} from './VSCodeDemoFrame'

const MOCK_YAML = [
  'type: server',
  'title: User Service Mock',
  'port: 8080',
  'endpoints:',
  '  - method: get',
  '    path: /users/:id',
  '    status: 200',
  '    format: json',
  '    body:',
  '      id: "${url.id}"',
  '      name: "Mehrdad Shobeiri"',
  '      email: "mehrdad@mmt.dev"',
]

export default function MockServerIllustration() {
  return (
    <VSCodeDemoFrame minHeightClass="min-h-[420px] sm:min-h-[480px]">
      <VSCodeEditorTabs
        tabs={[{ id: 'mock', label: 'user-service.mmt', icon: 'server-environment', active: true }]}
      />
      <div className="flex flex-1 min-h-0">
        <YamlEditorPane lines={MOCK_YAML} />
      </div>
    </VSCodeDemoFrame>
  )
}
