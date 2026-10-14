"use client";

import { ArrowDown, ArrowUp, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  PIPELINE_FIELD_OPTIONS,
  type PipelineField,
  type PipelineStageKind,
  type PipelineTone,
  type SalesPipelineStage,
} from "@/lib/sales-pipeline";

type PipelineConfiguratorProps = {
  stages: SalesPipelineStage[];
  leadCounts: Record<string, number>;
  onUpdate: (id: string, patch: Partial<SalesPipelineStage>) => void;
  onRename: (id: string, nextName: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

const kinds: Array<{ value: PipelineStageKind; label: string }> = [
  { value: "open", label: "Active opportunity" },
  { value: "nurture", label: "Nurture / revisit later" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "disqualified", label: "Disqualified" },
];
const tones: Array<{ value: PipelineTone; label: string }> = [
  { value: "gold", label: "RR gold" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "red", label: "Red" },
  { value: "stone", label: "Neutral" },
];
const followUpOptions: Array<{ value: string; label: string }> = [
  { value: "0", label: "Today" },
  { value: "1", label: "1 day" },
  { value: "2", label: "2 days" },
  { value: "3", label: "3 days" },
  { value: "5", label: "5 days" },
  { value: "7", label: "1 week" },
  { value: "14", label: "2 weeks" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "never", label: "No follow-up" },
];

function StageCard({
  stage,
  index,
  total,
  leadCount,
  onUpdate,
  onRename,
  onMove,
  onRemove,
}: {
  stage: SalesPipelineStage;
  index: number;
  total: number;
  leadCount: number;
  onUpdate: (patch: Partial<SalesPipelineStage>) => void;
  onRename: (name: string) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const followUpValue = stage.followUpDays === null ? "never" : String(stage.followUpDays);

  return (
    <article className="rr-stage-config-card">
      <div className="rr-stage-config-top">
        <div className="rr-stage-order">{String(index + 1).padStart(2, "0")}</div>
        <div className="rr-stage-name-field">
          <label>Stage name</label>
          <input
            aria-label={`Stage name ${index + 1}`}
            key={stage.id}
            defaultValue={stage.name}
            maxLength={70}
            onBlur={(event) => {
              const name = event.currentTarget.value.trim();
              if (name && name !== stage.name) onRename(name);
              else event.currentTarget.value = stage.name;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </div>
        <div className="rr-stage-count">
          <b>{leadCount}</b>
          <small>{leadCount === 1 ? "lead" : "leads"}</small>
        </div>
        <div className="rr-stage-reorder">
          <button type="button" className="rr-icon-link" aria-label={`Move ${stage.name} up`} title="Move up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={14}/></button>
          <button type="button" className="rr-icon-link" aria-label={`Move ${stage.name} down`} title="Move down" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown size={14}/></button>
        </div>
      </div>

      <div className="rr-stage-config-fields">
        <label>
          <span>Stage behaviour</span>
          <select value={stage.kind} onChange={(event) => onUpdate({ kind: event.target.value as PipelineStageKind })}>
            {kinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
          </select>
        </label>
        <label>
          <span>Next follow-up</span>
          <select value={followUpValue} onChange={(event) => onUpdate({ followUpDays: event.target.value === "never" ? null : Number(event.target.value) })}>
            {followUpOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>Label colour</span>
          <select value={stage.tone} onChange={(event) => onUpdate({ tone: event.target.value as PipelineTone })}>
            {tones.map((tone) => <option key={tone.value} value={tone.value}>{tone.label}</option>)}
          </select>
        </label>
      </div>

      <label className="rr-stage-next-action">
        <span>Default next action</span>
        <input
          value={stage.defaultNextAction}
          maxLength={180}
          onChange={(event) => onUpdate({ defaultNextAction: event.target.value })}
          placeholder="What should happen next?"
        />
      </label>

      <div className="rr-stage-config-options">
        <label className="rr-stage-check">
          <input
            type="radio"
            name="rr-initial-pipeline-stage"
            checked={stage.isInitial}
            disabled={!stage.active || stage.kind !== "open"}
            onChange={() => onUpdate({ isInitial: true })}
          />
          <span><b>New leads start here</b><small>Only one active stage can be the starting point.</small></span>
        </label>
        <label className="rr-stage-check">
          <input
            type="checkbox"
            checked={stage.active}
            disabled={stage.isInitial}
            onChange={(event) => onUpdate({ active: event.target.checked })}
          />
          <span><b>Stage active</b><small>Inactive stages remain visible for existing leads.</small></span>
        </label>
        <button type="button" className="rr-stage-delete" onClick={onRemove} title="Remove stage"><Trash2 size={14}/> Remove</button>
      </div>

      <details className="rr-stage-requirements">
        <summary><SlidersHorizontal size={15}/> Required information on entry <span>{stage.requiredFields.length} rules</span></summary>
        <p>When a lead moves into this stage, RR checks the selected fields. The move is blocked until missing information is supplied.</p>
        <div className="rr-stage-required-grid">
          {PIPELINE_FIELD_OPTIONS.map((field) => (
            <label key={field.key} className="rr-stage-required-option">
              <input
                type="checkbox"
                checked={stage.requiredFields.includes(field.key)}
                onChange={(event) => {
                  const requiredFields = event.target.checked
                    ? [...new Set([...stage.requiredFields, field.key])]
                    : stage.requiredFields.filter((key: PipelineField) => key !== field.key);
                  onUpdate({ requiredFields });
                }}
              />
              <span><b>{field.label}</b><small>{field.help}</small></span>
            </label>
          ))}
        </div>
      </details>
    </article>
  );
}

export default function PipelineConfigurator({
  stages,
  leadCounts,
  onUpdate,
  onRename,
  onMove,
  onAdd,
  onRemove,
}: PipelineConfiguratorProps) {
  const activeCount = stages.filter((stage) => stage.active).length;
  const automaticFollowUps = stages.filter((stage) => stage.active && stage.followUpDays !== null).length;

  return (
    <div className="rr-pipeline-configurator">
      <div className="rr-page-heading">
        <div>
          <span className="rr-eyebrow">SALES WORKFLOW · CONFIGURE ONCE</span>
          <h1>Pipeline setup</h1>
          <p>Configure the stages RR uses to move an enquiry from first contact to a decision. Changes save automatically.</p>
        </div>
        <button className="rr-primary" onClick={onAdd}><Plus size={16}/> Add stage</button>
      </div>

      <div className="rr-library-summary rr-pipeline-config-summary">
        <div><span>Total stages</span><b>{stages.length}</b></div>
        <div><span>Active stages</span><b>{activeCount}</b></div>
        <div><span>Stages with follow-up</span><b>{automaticFollowUps}</b></div>
      </div>

      <div className="rr-pipeline-config-help">
        <b>How this works</b>
        <p>Move stages with the arrows. Rename a stage by editing its name and leaving the field. Choose the starting stage, default next action and follow-up timing. Expand each stage to set which details are required before a lead can enter it.</p>
        <p><strong>Safety rule:</strong> won stages require the agreement and initial-payment checks configured below; lost/disqualified stages can require a reason. Those checks are manual until the relevant provider integrations are connected.</p>
      </div>

      <div className="rr-stage-config-list">
        {stages.map((stage, index) => (
          <StageCard
            key={stage.id}
            stage={stage}
            index={index}
            total={stages.length}
            leadCount={leadCounts[stage.id] || 0}
            onUpdate={(patch) => onUpdate(stage.id, patch)}
            onRename={(name) => onRename(stage.id, name)}
            onMove={(direction) => onMove(stage.id, direction)}
            onRemove={() => onRemove(stage.id)}
          />
        ))}
      </div>

      <div className="rr-stage-config-footer">
        <button className="rr-secondary" onClick={onAdd}><Plus size={15}/> Add another stage</button>
        <span>Changes are encrypted and saved with the workspace. Check the save status in the top bar.</span>
      </div>
    </div>
  );
}
