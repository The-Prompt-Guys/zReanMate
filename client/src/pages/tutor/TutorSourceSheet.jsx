import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { BottomSheet, SheetOption, SheetSubtitle, SheetTitle } from '../../components/BottomSheet.jsx';
import { useKits } from '../../kits/KitsContext.jsx';
import { useT } from '../../i18n/index.js';

/**
 * Which material the tutor should answer from.
 *
 * Sits where the message-quota chip used to, because this is the choice that
 * changes the answers: kit-wide retrieval pulls whichever chunk matches best
 * anywhere in the kit, so a question about one PDF could be answered — and
 * cited — out of an unrelated one beside it.
 *
 * "All materials" stays on the list. It is the old behaviour, and it is the
 * right one when the student does not yet know which file holds the answer.
 *
 * Each material has its own conversation, so switching is not destructive:
 * coming back to a file returns to the thread you were having about it.
 */
export const TutorSourceSheet = () => {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { getFiles, loadFiles } = useKits();

  const kitId = params.get('kitId');
  const selected = params.get('sourceId');
  const closeTo = `/tutor?kitId=${encodeURIComponent(kitId ?? '')}${selected ? `&sourceId=${encodeURIComponent(selected)}` : ''}`;

  useEffect(() => { if (kitId) loadFiles(kitId).catch(() => {}); }, [kitId, loadFiles]);
  const files = kitId ? getFiles(kitId) : [];

  const choose = (fileId) => {
    navigate(
      `/tutor?kitId=${encodeURIComponent(kitId ?? '')}${fileId ? `&sourceId=${encodeURIComponent(fileId)}` : ''}`,
      { replace: true },
    );
  };

  return (
    <BottomSheet closeTo={closeTo} labelledBy="tutor-source-title">
      <SheetTitle id="tutor-source-title">{t('tutor.chooseSource')}</SheetTitle>
      <SheetSubtitle>{t('tutor.chooseSourceHint')}</SheetSubtitle>

      <div className="mt-5 space-y-3">
        <SheetOption
          onClick={() => choose(null)}
          tone="blue"
          icon={<FolderMark />}
          title={t('tutor.allMaterials')}
          description={!selected ? t('tutor.currentlySelected') : t('tutor.allMaterialsHint')}
        />

        {/* A material that is still being read has no chunks to retrieve from,
            so it is listed but cannot be picked — offering it would produce a
            tutor that answers "I could not find that in the material". */}
        {files.map((file) => {
          const ready = file.status === 'ready';
          const isSelected = file.id === selected;
          return (
            <SheetOption
              key={file.id}
              disabled={!ready}
              onClick={ready ? () => choose(file.id) : undefined}
              tone={isSelected ? 'green' : 'violet'}
              icon={<FileMark />}
              title={file.name}
              description={
                isSelected
                  ? t('tutor.currentlySelected')
                  : ready
                    ? t(`kits.kind_${file.kind ?? 'document'}`)
                    : t('tutor.sourceNotReady')
              }
            />
          );
        })}

        {files.length === 0 && (
          <p className="py-2 text-base font-medium text-ink-600">{t('tutor.noMaterials')}</p>
        )}
      </div>
    </BottomSheet>
  );
};

const FolderMark = () => (
  <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
    <path
      d="M3 7a2 2 0 0 1 2-2h4.6l2 2.4H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
  </svg>
);

const FileMark = () => (
  <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
    <path
      d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
    <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);
