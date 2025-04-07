export type Merge<T> = {
  [K in keyof T]: T[K]
}

export type AddOR<T, K extends keyof T, V> = Merge<
  Omit<T, K> & {
    [key in K]: T[K] | V
  }
>

export type Update<T, K extends keyof T, V> = Merge<
  Omit<T, K> & {
    [key in K]: V
  }
>

export type ToRecord<T> = Record<keyof T, T[keyof T]>
