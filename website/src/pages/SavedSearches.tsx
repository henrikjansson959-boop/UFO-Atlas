import { Save, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { SavedSearchCard } from '../components/SavedSearchCard';
import { keywordAPI, savedSearchAPI, tagAPI } from '../services/api';
import type { Keyword, SavedSearch, ScanResult, Tag, TagGroup } from '../types';

const SavedSearches = () => {
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [keywordInput, setKeywordInput] = useState('');
  const [searchNameInput, setSearchNameInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [versionHistory, setVersionHistory] = useState<Record<string, SavedSearch[]>>({});
  const [refiningSearch, setRefiningSearch] = useState<SavedSearch | null>(null);
  const [pendingDeleteSearchId, setPendingDeleteSearchId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tagGroupsData, keywordsData, savedSearchesData] = await Promise.all([
        tagAPI.getTagGroups(),
        keywordAPI.getKeywords(),
        savedSearchAPI.getSavedSearches(),
      ]);
      setTagGroups(tagGroupsData);
      setKeywords(keywordsData);
      setSavedSearches(savedSearchesData);
      setExpandedGroups(new Set(tagGroupsData.map((group) => group.tagGroupId)));
      setPendingDeleteSearchId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const resetForm = () => {
    setSearchNameInput('');
    setKeywordInput('');
    setSelectedTagIds(new Set());
    setRefiningSearch(null);
    setPendingDeleteSearchId(null);
  };

  const handleSaveSearch = async () => {
    if (!searchNameInput.trim()) {
      setError('Please enter a search name');
      return;
    }

    const keywordsArray = keywordInput
      .split(',')
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    if (keywordsArray.length === 0) {
      setError('Please enter at least one keyword');
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      if (refiningSearch) {
        await savedSearchAPI.refineSavedSearch(
          refiningSearch.savedSearchId,
          searchNameInput,
          keywordsArray,
          Array.from(selectedTagIds),
        );
        setSuccess(`Search \"${searchNameInput}\" refined successfully.`);
      } else {
        await savedSearchAPI.createSavedSearch(searchNameInput, keywordsArray, Array.from(selectedTagIds));
        setSuccess(`Search \"${searchNameInput}\" saved successfully.`);
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save search');
    }
  };

  const handleExecuteSearch = async (search: SavedSearch) => {
    try {
      setExecuting(true);
      setError(null);
      setScanResult(null);
      const result = await savedSearchAPI.executeSavedSearch(search.savedSearchId);
      setScanResult(result);
      setSuccess(`Search \"${search.searchName}\" executed successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute search');
    } finally {
      setExecuting(false);
    }
  };

  const handleRefineSearch = (search: SavedSearch) => {
    setRefiningSearch(search);
    setSearchNameInput(search.searchName);
    setKeywordInput(search.keywordsUsed.join(', '));
    setSelectedTagIds(new Set(search.selectedTagIds));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSearch = async (searchId: number, searchName: string) => {
    if (pendingDeleteSearchId !== searchId) {
      setPendingDeleteSearchId(searchId);
      setSuccess(`Click delete again to remove \"${searchName}\".`);
      return;
    }

    try {
      setError(null);
      await savedSearchAPI.deleteSavedSearch(searchId);
      setPendingDeleteSearchId(null);
      setSuccess(`Search \"${searchName}\" deleted successfully.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete search');
    }
  };

  const handleLoadSearch = (search: SavedSearch) => {
    setRefiningSearch(null);
    setSearchNameInput(search.searchName);
    setKeywordInput(search.keywordsUsed.join(', '));
    setSelectedTagIds(new Set(search.selectedTagIds));
    setPendingDeleteSearchId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleVersionHistory = async (searchName: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(searchName)) {
        next.delete(searchName);
      } else {
        next.add(searchName);
      }
      return next;
    });

    if (!versionHistory[searchName]) {
      try {
        const versions = await savedSearchAPI.getVersionHistory(searchName);
        setVersionHistory((prev) => ({ ...prev, [searchName]: versions }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load version history');
      }
    }
  };

  const getTagName = (tagId: number) => {
    for (const group of tagGroups) {
      const tag = group.tags.find((entry: Tag) => entry.tagId === tagId);
      if (tag) return tag.tagName;
    }

    return `Tag ${tagId}`;
  };

  const latestSearches = savedSearches.reduce((acc: SavedSearch[], search) => {
    const existing = acc.find((item) => item.searchName === search.searchName);
    if (!existing || search.version > existing.version) {
      return [...acc.filter((item) => item.searchName !== search.searchName), search];
    }
    return acc;
  }, []);

  if (loading) {
    return <div className="ui-empty"><p>Loading saved searches...</p></div>;
  }

  return (
    <div className="ui-stack">
      <div className="page-header">
        <div className="page-heading">
          <span className="hero-badge">Saved</span>
          <h1>Saved searches</h1>
          <p>Version and rerun reusable searches.</p>
        </div>
      </div>

      {error && <div className="ui-note"><p>{error}</p></div>}
      {success && <div className="ui-note"><p>{success}</p></div>}

      {scanResult && (
        <div className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2>Execution complete</h2>
              <p>{scanResult.discoveredUrls.length} URLs discovered.</p>
            </div>
            <span className="ui-badge success">{scanResult.discoveredUrls.length} discovered</span>
          </div>
          <div className="ui-pill-row">
            <span className="ui-pill">Scan Job: {scanResult.scanJobId.slice(0, 8)}</span>
            <span className="ui-pill">Keywords: {scanResult.keywordsUsed.join(', ') || 'None'}</span>
            <span className="ui-pill">Tags: {scanResult.selectedTagIds.length > 0 ? scanResult.selectedTagIds.join(', ') : 'All tags'}</span>
          </div>
        </div>
      )}

      <div className="ui-grid-2">
        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2>{refiningSearch ? `Refine ${refiningSearch.searchName} v${refiningSearch.version}` : 'Create search'}</h2>
              <p>{refiningSearch ? 'Save a new version.' : 'Store a reusable search.'}</p>
            </div>
            {refiningSearch && (
              <button type="button" className="ui-button-secondary" onClick={resetForm}>
                Cancel refine
              </button>
            )}
          </div>

          <div className="ui-stack">
            <div className="ui-field">
              <label htmlFor="search-name">Search name</label>
              <input id="search-name" type="text" value={searchNameInput} onChange={(event) => setSearchNameInput(event.target.value)} placeholder="Roswell cluster sweep" className="ui-input" />
            </div>
            <div className="ui-field">
              <label htmlFor="search-keywords">Keywords (comma-separated)</label>
              <input id="search-keywords" type="text" value={keywordInput} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setKeywordInput(event.target.value)} placeholder="ufo, roswell, witness" className="ui-input" />
              <p className="helper-text">Active DB keywords: {keywords.filter((keyword) => keyword.isActive).map((keyword) => keyword.keywordText).join(', ') || 'None'}</p>
            </div>
            <div className="ui-field">
              <label>Selected tags</label>
              <p className="helper-text">{selectedTagIds.size > 0 ? Array.from(selectedTagIds).map((tagId) => getTagName(tagId)).join(', ') : 'All tags'}</p>
            </div>
            <div className="ui-actions">
              <button type="button" onClick={handleSaveSearch} className="ui-button">
                <Save size={15} />
                {refiningSearch ? 'Save version' : 'Save search'}
              </button>
              {!refiningSearch && (
                <button type="button" className="ui-button-secondary" onClick={() => setError('Execute Once requires a dedicated backend endpoint. Use Save + Execute for now.')}>
                  Execute once
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2>Tag filters</h2>
              <p>No selection means all tags.</p>
            </div>
            {selectedTagIds.size > 0 && <span className="ui-badge">{selectedTagIds.size} selected</span>}
          </div>

          <div className="ui-stack" style={{ maxHeight: '32rem', overflowY: 'auto' }}>
            {tagGroups.map((group) => (
              <div key={group.tagGroupId} className="ui-table-panel">
                <button type="button" onClick={() => toggleGroup(group.tagGroupId)} className="related-item">
                  <span>{group.groupName}</span>
                  <span>{expandedGroups.has(group.tagGroupId) ? 'Hide' : 'Show'} - {group.tags.length} tags</span>
                </button>
                {expandedGroups.has(group.tagGroupId) && (
                  <div className="ui-stack" style={{ padding: '16px' }}>
                    {group.tags.length === 0 ? (
                      <p className="helper-text">No tags in this group.</p>
                    ) : (
                      group.tags.map((tag) => (
                        <label key={tag.tagId} className="related-item" style={{ cursor: 'pointer' }}>
                          <span>
                            <input type="checkbox" checked={selectedTagIds.has(tag.tagId)} onChange={() => toggleTag(tag.tagId)} style={{ marginRight: '10px' }} />
                            {tag.tagName}
                          </span>
                          <span>{selectedTagIds.has(tag.tagId) ? 'Selected' : 'Available'}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2>Saved search catalog</h2>
            <p>Latest versions first.</p>
          </div>
          <span className="ui-badge muted">{latestSearches.length} active definitions</span>
        </div>

        {latestSearches.length === 0 ? (
          <div className="ui-empty"><p>No saved searches yet. Create one above to start building reusable queries.</p></div>
        ) : (
          <div className="space-y-4">
            {latestSearches.map((search: SavedSearch) => (
              <SavedSearchCard
                key={search.savedSearchId}
                search={search}
                tagGroups={tagGroups}
                executing={executing}
                pendingDelete={pendingDeleteSearchId === search.savedSearchId}
                expandedVersions={expandedVersions}
                versionHistory={versionHistory}
                onExecute={handleExecuteSearch}
                onRefine={handleRefineSearch}
                onLoad={handleLoadSearch}
                onDelete={handleDeleteSearch}
                onToggleVersionHistory={toggleVersionHistory}
                onScheduleUpdate={loadData}
              />
            ))}
          </div>
        )}
      </section>

      <div className="ui-note">
        <div className="ui-panel-header">
          <div>
            <h3>Live backend</h3>
            <p>Saved searches execute against the backend and feed the queue.</p>
          </div>
          <span className="ui-badge">
            <Search size={14} />
            Backend connected
          </span>
        </div>
      </div>
    </div>
  );
};

export default SavedSearches;