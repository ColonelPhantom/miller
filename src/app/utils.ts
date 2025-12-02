import van from "vanjs-core";
const v = van.tags;

export const Button = (onclick: () => void, text: string) =>
    v.button({ class: "bg-green-500 dark:bg-green-700 p-2", onclick }, text);

export const InlineButton = (
    onclick: () => void,
    title: string,
    text: string,
) =>
    v.button(
        {
            class: "mx-1 w-[2em] flex-none",
            title,
            onclick,
        },
        text,
    );
