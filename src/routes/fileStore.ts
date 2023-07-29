import { writable } from "svelte/store";

export type FileStore = {
    prev?: string;
    current?: string;
    next?: string;  
}

export const fileStore = writable<FileStore>({prev: undefined, current: undefined, next: undefined});