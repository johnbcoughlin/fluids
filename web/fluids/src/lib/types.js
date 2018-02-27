import {TwoPhaseRenderTarget} from "./render_targets";

export type StaggerXGrid = TwoPhaseRenderTarget & StaggerXGrid;
export type StaggerYGrid = TwoPhaseRenderTarget & StaggerYGrid;

// grid types
interface Multigrid {}
interface FinestGrid {}

// types of grid contents
// equation elements
interface Unknown {}
interface RightHandSide {}
interface Residual {}
interface Correction {}

interface Mask {}
interface Distances {}

// concrete types
export class Pressure extends TwoPhaseRenderTarget implements FinestGrid, Unknown {}
export class PressureMultigrid extends TwoPhaseRenderTarget implements Multigrid, Unknown {}

