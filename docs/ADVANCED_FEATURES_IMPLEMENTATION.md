# Advanced Features Implementation Guide

## Overview

This document outlines the implementation of two major features:
1. **Optional Semantic Search** (downloadable resource)
2. **Web Search Integration** (SerpAPI)

Both features are **optional** and **configurable** by the user.

## Architecture

### Tool Availability Matrix

| Configuration | Dictionary | Semantic | Web | Prompt Variant |
|--------------|-----------|----------|-----|----------------|
| Basic | ✓ | - | - | `dictionaryOnlyPrompt` |
| + Semantic | ✓ | ✓ | - | `dictionaryWithSemanticPrompt` |
| + Web | ✓ | - | ✓ | `dictionaryWithWebSearchPrompt` |
| Full | ✓ | ✓ | ✓ | `fullFeaturesPrompt` |

### Component Structure

```
┌─────────────────────────────────────────┐
│           User Interface                │
│  ┌──────────┐  ┌─────────────────────┐ │
│  │ Settings │  │ Chat (Smart Tab)    │ │
│  │          │  │  - Resource Manager │ │
│  │- API Keys│  │  - Use Web Search ☑ │ │
│  │- SerpAPI │  │                     │ │
│  │- Resources│ │                     │ │
│  └──────────┘  └─────────────────────┘ │
└─────────────────────────────────────────┘
           ↓                    ↓
┌──────────────────────────────────────────┐
│        DictionaryToolAgent               │
│  - Dynamically loads tools based on:     │
│    1. API config (OpenAI/Google)         │
│    2. Downloaded resources               │
│    3. SerpAPI config                     │
│  - Selects appropriate system prompt     │
└──────────────────────────────────────────┘
           ↓
    ┌─────┴─────────────┬──────────────┐
    ↓                   ↓              ↓
┌──────────┐  ┌──────────────┐  ┌───────────┐
│Dictionary│  │   Semantic   │  │    Web    │
│  Tool    │  │ Search Tool  │  │Search Tool│
│          │  │ (conditional)│  │(conditional)│
└──────────┘  └──────────────┘  └───────────┘
                     ↓                ↓
            ┌────────────┐    ┌──────────┐
            │ Embeddings │    │ SerpAPI  │
            │  (46 MB)   │    │          │
            │Google Drive│    │          │
            └────────────┘    └──────────┘
```

## ✅ Completed Implementation

### 1. Resource Management System
**File**: `src/services/resources/ResourceManager.ts`

Features:
- ✅ Download resources from Google Drive with progress tracking
- ✅ Check resource availability
- ✅ Validate provider requirements (OpenAI/Google only)
- ✅ Delete resources
- ✅ Track download status in AsyncStorage

**Google Drive Link**: `https://drive.google.com/uc?export=download&id=1f7gQVH2Y1ofn6n6WyvZToTH3vLZxud2L`

### 2. SerpAPI Configuration
**File**: `src/services/storage/serpApiStorage.ts`

Features:
- ✅ Save/load SerpAPI key and enabled status
- ✅ Check if web search is available
- ✅ Delete configuration

### 3. Web Search Service
**File**: `src/services/web/WebSearchService.ts`

Features:
- ✅ Search using SerpAPI (Google Search)
- ✅ Arabic language preference
- ✅ Format results with sources and links
- ✅ Extract domain names

### 4. Tool Definitions
**Files**:
- `src/agents/tools/webSearchTools.ts` - Web search tool
- `src/agents/tools/WebSearchToolExecutor.ts` - Web search executor

### 5. Dynamic System Prompts
**File**: `src/prompts/system/dynamicPrompts.ts`

4 prompt variants:
- ✅ Dictionary only (basic)
- ✅ Dictionary + Semantic search
- ✅ Dictionary + Web search
- ✅ Dictionary + Semantic + Web (full)

## 🔨 Remaining Implementation

### 1. Update EmbeddingLoader

**File to modify**: `src/services/semantic/EmbeddingLoader.ts`

**Changes needed**:
```typescript
// Instead of loading from bundled asset, load from downloaded resource
static async loadEmbeddings(db: SQLiteDatabase): Promise<void> {
  // Check if resource is downloaded
  const downloaded = await ResourceManager.isDownloaded(ResourceType.SEMANTIC_EMBEDDINGS);

  if (!downloaded) {
    console.log('⚠ Semantic embeddings not downloaded');
    return;
  }

  // Load from resources directory
  const path = ResourceManager.getResourcePath(ResourceType.SEMANTIC_EMBEDDINGS);

  // ... rest of loading logic
}
```

### 2. Update DictionaryToolAgent

**File to modify**: `src/agents/DictionaryToolAgent.ts`

**Changes needed**:
```typescript
import { ResourceManager, ResourceType } from '@services/resources/ResourceManager';
import { SerpAPIStorage } from '@services/storage/serpApiStorage';
import { webSearchTool } from './tools/webSearchTools';
import { WebSearchToolExecutor } from './tools/WebSearchToolExecutor';
import { getSystemPrompt } from '@/prompts/system/dynamicPrompts';

export class DictionaryToolAgent extends BaseAgent {
  private webSearchExecutor: WebSearchToolExecutor | null = null;

  async processMessage(request: AgentRequest): Promise<AgentResponse> {
    // Check available tools
    const hasSemanticSearch = await ResourceManager.canUseResource(
      ResourceType.SEMANTIC_EMBEDDINGS,
      request.apiConfig?.provider
    );

    const serpConfig = await SerpAPIStorage.getConfig();
    const hasWebSearch = serpConfig !== null && serpConfig.enabled;

    // Initialize executors
    if (hasSemanticSearch.canUse && request.apiConfig) {
      this.initSemanticExecutor(request.apiConfig);
    }

    if (hasWebSearch && serpConfig) {
      this.webSearchExecutor = new WebSearchToolExecutor(serpConfig.apiKey);
    }

    // Build tools array
    const tools = [dictionarySearchTool];
    if (hasSemanticSearch.canUse) tools.push(searchWordByMeaningTool);
    if (hasWebSearch) tools.push(webSearchTool);

    // Get appropriate system prompt
    const systemPrompt = getSystemPrompt({
      hasDictionary: true,
      hasSemanticSearch: hasSemanticSearch.canUse,
      hasWebSearch,
    });

    // Build messages with dynamic prompt
    const messages: ProviderMessage[] = [
      { role: 'system', content: systemPrompt },
      ...request.messageHistory,
      { role: 'user', content: request.userMessage },
    ];

    // ... rest of tool calling loop with routing to appropriate executor
  }
}
```

### 3. Update dictionaryStoreSQLite.ts

**File to modify**: `src/store/dictionaryStoreSQLite.ts`

**Changes needed**:
```typescript
// Remove automatic embedding loading
// EmbeddingLoader will be called manually by ResourceManager

// In initializeDatabase, REMOVE these lines:
// await EmbeddingLoader.loadEmbeddings(database);
// const count = await EmbeddingLoader.verifyEmbeddings(database);
```

### 4. Create Resource Management UI

**New file**: `src/components/chat/ResourceManagerModal.tsx`

**Features needed**:
- List available resources
- Show download status (not downloaded / downloading with progress / downloaded)
- Download button
- Delete button
- Show size and requirements
- Disable if provider not available

**Example structure**:
```typescript
interface ResourceItem {
  metadata: ResourceMetadata;
  status: ResourceStatus;
  canUse: boolean;
}

export function ResourceManagerModal({ visible, onClose }) {
  const [resources, setResources] = useState<ResourceItem[]>([]);

  // Load resources status
  // Handle download with progress
  // Handle delete
  // Show requirements

  return (
    <Modal visible={visible}>
      {resources.map(resource => (
        <ResourceCard
          key={resource.metadata.id}
          resource={resource}
          onDownload={handleDownload}
          onDelete={handleDelete}
        />
      ))}
    </Modal>
  );
}
```

### 5. Update Smart Tab UI

**File to modify**: `app/(tabs)/smart.tsx`

**Add**:
1. "Resources" button to open ResourceManagerModal
2. "Use Web Search" toggle (visible when SerpAPI configured)
3. Status indicators for available tools

### 6. Update Settings UI

**File to modify**: `app/(tabs)/settings.tsx`

**Add**:
1. SerpAPI configuration section (similar to API keys)
2. Resource management section (show downloaded resources, total size)
3. "Clear Resources" option

## 📋 Implementation Checklist

- [ ] Update EmbeddingLoader to use ResourceManager
- [ ] Update DictionaryToolAgent with conditional tools
- [ ] Remove automatic embedding loading from dictionaryStoreSQLite
- [ ] Create ResourceManagerModal component
- [ ] Add ResourceCard component
- [ ] Update smart.tsx with resources button
- [ ] Add web search toggle to smart.tsx
- [ ] Add SerpAPI config to settings.tsx
- [ ] Add resource management to settings.tsx
- [ ] Add translations to ar.json
- [ ] Test all 4 configurations
- [ ] Update documentation

## 🧪 Testing Scenarios

### Scenario 1: Basic (Dictionary Only)
- No resources downloaded
- No SerpAPI configured
- Should use `dictionaryOnlyPrompt`
- Only `search_dictionary` available

### Scenario 2: With Semantic Search
- Embeddings downloaded
- OpenAI API configured
- Should use `dictionaryWithSemanticPrompt`
- `search_dictionary` + `search_word_by_meaning` available

### Scenario 3: With Web Search
- No embeddings
- SerpAPI configured
- Should use `dictionaryWithWebSearchPrompt`
- `search_dictionary` + `search_web` available

### Scenario 4: Full Features
- Embeddings downloaded
- OpenAI + SerpAPI configured
- Should use `fullFeaturesPrompt`
- All 3 tools available
- LLM should prioritize: Dictionary → Semantic → Web

## 📝 Translation Keys Needed

Add to `src/locales/ar.json`:

```json
{
  "resources": {
    "title": "الموارد الإضافية",
    "download": "تحميل",
    "downloading": "جاري التحميل...",
    "delete": "حذف",
    "downloaded": "تم التحميل",
    "notDownloaded": "لم يتم التحميل",
    "size": "الحجم",
    "requires": "يتطلب",
    "confirmDelete": "هل أنت متأكد من حذف هذا المورد؟",
    "downloadError": "خطأ في التحميل",
    "deleteSuccess": "تم الحذف بنجاح"
  },
  "webSearch": {
    "enabled": "استخدام البحث على الإنترنت",
    "disabled": "البحث على الإنترنت معطل",
    "requiresSerpAPI": "يتطلب تكوين SerpAPI"
  },
  "settings": {
    "serpapi": {
      "title": "إعدادات البحث على الإنترنت",
      "apiKey": "مفتاح SerpAPI",
      "enabled": "تفعيل البحث على الإنترنت",
      "getKey": "احصل على مفتاح من serpapi.com"
    }
  }
}
```

## 🚀 Benefits of This Architecture

1. **Optional Features**: Users only download what they need
2. **Smaller App Size**: No 46MB embeddings in bundle
3. **Flexible**: Easy to add more resources or search providers
4. **Smart Tool Selection**: LLM gets appropriate tools based on availability
5. **Cost Effective**: Users can choose OpenAI (embeddings) OR SerpAPI (web) OR both
6. **User Control**: Full control over resources and features

## 📊 Storage Impact

### Before (bundled)
- App size: +46MB (embeddings)
- SQLite: +56MB (vector table)
- Total: +102MB

### After (optional download)
- App size: No change
- Optional download: 46MB (if user chooses)
- SQLite: +56MB (if resource loaded)
- User saves: 46MB if not needed

## 🔐 Security Notes

- Google Drive link is public (read-only)
- SerpAPI key stored in AsyncStorage (encrypted on device)
- No credentials bundled in app
- Resources downloaded over HTTPS

## Next Steps

1. Complete remaining implementation tasks
2. Test all 4 tool configurations
3. Add UI components for resource management
4. Update settings with SerpAPI configuration
5. Test download/delete flows
6. Deploy to TestFlight for testing
